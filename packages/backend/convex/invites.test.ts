import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import { INVITE_TTL_MS } from "./invites";
import { sha256Hex } from "./lib/tokens";
import { setupTest, stubAuthEnv, TEST_SITE_URL, type TestConvex } from "./test.setup";

const owner = { subject: "user-owner", name: "Kris", email: "kris@example.com" };
const partner = { subject: "user-partner", name: "Partner", email: "partner@example.com" };

async function setUp() {
  const t = setupTest({ withAuth: true });
  await t.withIdentity(owner).mutation(api.setup.createWorkspace, { workspaceName: "Home" });
  return t;
}

async function invite(t: TestConvex, email = partner.email) {
  return t.withIdentity(owner).action(api.invites.create, { email });
}

describe("invites.create", () => {
  beforeEach(() => stubAuthEnv());
  afterEach(() => vi.unstubAllEnvs());

  it("returns the link once and stores only the token's hash", async () => {
    const t = await setUp();
    const result = await invite(t, "  Partner@Example.com ");
    expect(result.token).toMatch(/^inv_[A-Za-z0-9_-]{43}$/);
    expect(result.url).toBe(`${TEST_SITE_URL}/sign-up?invite=${result.token}`);

    const stored = await t.run((ctx) => ctx.db.get("invites", result.inviteId));
    expect(stored?.email).toBe("partner@example.com");
    expect(stored?.tokenHash).toBe(await sha256Hex(result.token));
    expect(JSON.stringify(stored)).not.toContain(result.token);
    expect(stored!.expiresAt - stored!._creationTime).toBeGreaterThan(INVITE_TTL_MS - 60_000);
  });

  it("is owner only", async () => {
    const t = await setUp();
    const { token } = await invite(t);
    await t.withIdentity(partner).mutation(api.invites.accept, { token });
    await expect(t.withIdentity(partner).action(api.invites.create, { email: "x@example.com" })).rejects.toThrow(
      /Only the workspace owner/,
    );
    await expect(t.withIdentity(partner).query(api.invites.list, {})).rejects.toThrow(/Only the workspace owner/);
  });

  it("rejects an invalid email", async () => {
    const t = await setUp();
    await expect(invite(t, "not-an-email")).rejects.toThrow(/valid email/);
  });

  it("replaces a pending invite for the same email", async () => {
    const t = await setUp();
    const first = await invite(t);
    const second = await invite(t);
    const list = await t.withIdentity(owner).query(api.invites.list, {});
    expect(list.map((row) => [row._id, row.state])).toEqual([
      [second.inviteId, "pending"],
      [first.inviteId, "revoked"],
    ]);
    await expect(t.withIdentity(partner).mutation(api.invites.accept, { token: first.token })).rejects.toThrow(
      /revoked/,
    );
  });

  it("rejects an email that already belongs to a member", async () => {
    const t = setupTest({ withAuth: true });
    const res = await t.fetch("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: TEST_SITE_URL },
      body: JSON.stringify({ email: owner.email, password: "correct-horse-battery", name: owner.name }),
    });
    expect(res.status).toBe(200);
    const user = await t.run((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "email", value: owner.email }],
      }),
    );
    const asOwner = t.withIdentity({ ...owner, subject: String(user!._id) });
    await asOwner.mutation(api.setup.createWorkspace, {});
    await expect(asOwner.action(api.invites.create, { email: "KRIS@example.com" })).rejects.toThrow(
      /already a member/,
    );
  });
});

describe("invites.accept", () => {
  beforeEach(() => stubAuthEnv());
  afterEach(() => vi.unstubAllEnvs());

  it("creates the member row and marks the invite accepted", async () => {
    const t = await setUp();
    const { token, inviteId } = await invite(t);
    const result = await t.withIdentity(partner).mutation(api.invites.accept, { token });
    expect(result.alreadyMember).toBe(false);

    const current = await t.withIdentity(partner).query(api.workspace.current, {});
    expect(current.me).toMatchObject({ displayName: "Partner", role: "member" });
    expect(current.members).toHaveLength(2);
    const list = await t.withIdentity(owner).query(api.invites.list, {});
    expect(list.find((row) => row._id === inviteId)?.state).toBe("accepted");
  });

  it("matches the email case-insensitively", async () => {
    const t = await setUp();
    const { token } = await invite(t);
    await t.withIdentity({ ...partner, email: "PARTNER@example.com" }).mutation(api.invites.accept, { token });
    const current = await t.withIdentity(partner).query(api.workspace.current, {});
    expect(current.me.role).toBe("member");
  });

  it("rejects an expired token", async () => {
    const t = await setUp();
    const { token, inviteId } = await invite(t);
    await t.run((ctx) => ctx.db.patch("invites", inviteId, { expiresAt: Date.now() - 1 }));
    await expect(t.withIdentity(partner).mutation(api.invites.accept, { token })).rejects.toThrow(/expired/);
    await expect(t.withIdentity(partner).query(api.workspace.current, {})).rejects.toThrow(/not a member/);
  });

  it("rejects a revoked token", async () => {
    const t = await setUp();
    const { token, inviteId } = await invite(t);
    await t.withIdentity(owner).mutation(api.invites.revoke, { inviteId });
    await expect(t.withIdentity(partner).mutation(api.invites.accept, { token })).rejects.toThrow(/revoked/);
  });

  it("rejects a token used by someone with a different email", async () => {
    const t = await setUp();
    const { token, inviteId } = await invite(t);
    const stranger = { subject: "user-stranger", name: "Stranger", email: "stranger@example.com" };
    await expect(t.withIdentity(stranger).mutation(api.invites.accept, { token })).rejects.toThrow(
      /different email/,
    );
    // The invite stays usable by the right person.
    const stored = await t.run((ctx) => ctx.db.get("invites", inviteId));
    expect(stored?.acceptedAt).toBeUndefined();
  });

  it("rejects a reused token", async () => {
    const t = await setUp();
    const { token } = await invite(t);
    await t.withIdentity(partner).mutation(api.invites.accept, { token });
    // A second account with the same email (e.g. re-created) can't reuse the link.
    const again = { ...partner, subject: "user-partner-2" };
    await expect(t.withIdentity(again).mutation(api.invites.accept, { token })).rejects.toThrow(/already been used/);
  });

  it("is a no-op for someone who is already a member", async () => {
    const t = await setUp();
    const { token } = await invite(t);
    await t.withIdentity(partner).mutation(api.invites.accept, { token });
    const second = await t.withIdentity(partner).mutation(api.invites.accept, { token });
    expect(second.alreadyMember).toBe(true);
  });

  it("rejects an unknown token and signed-out callers", async () => {
    const t = await setUp();
    await expect(t.withIdentity(partner).mutation(api.invites.accept, { token: "inv_nope" })).rejects.toThrow(
      /isn't valid/,
    );
    const { token } = await invite(t);
    await expect(t.mutation(api.invites.accept, { token })).rejects.toThrow(/Sign in first/);
  });
});

describe("invites.revoke", () => {
  beforeEach(() => stubAuthEnv());
  afterEach(() => vi.unstubAllEnvs());

  it("can't revoke an accepted invite", async () => {
    const t = await setUp();
    const { token, inviteId } = await invite(t);
    await t.withIdentity(partner).mutation(api.invites.accept, { token });
    await expect(t.withIdentity(owner).mutation(api.invites.revoke, { inviteId })).rejects.toThrow(/already accepted/);
  });
});
