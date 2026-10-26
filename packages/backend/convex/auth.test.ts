import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { components } from "./_generated/api";
import { createAuth, MISSING_SECRET_MESSAGE } from "./auth";
import { setupTest, stubAuthEnv, TEST_SITE_URL, type TestConvex } from "./test.setup";

const DAY = 24 * 60 * 60 * 1000;

async function signUp(t: TestConvex, email: string) {
  return t.fetch("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: TEST_SITE_URL },
    body: JSON.stringify({ email, password: "correct-horse-battery", name: "Test User" }),
  });
}

/** An existing workspace with one owner, so sign-up is past the setup phase. */
async function seedOwner(t: TestConvex) {
  return t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Home",
      slug: "home",
      createdBy: "owner-user",
    });
    const ownerId = await ctx.db.insert("members", {
      workspaceId,
      userId: "owner-user",
      displayName: "Owner",
      role: "owner",
    });
    return { workspaceId, ownerId };
  });
}

async function seedInvite(
  t: TestConvex,
  email: string,
  fields: { expiresAt?: number; acceptedAt?: number; revokedAt?: number } = {},
) {
  const { workspaceId, ownerId } = await seedOwner(t);
  await t.run((ctx) =>
    ctx.db.insert("invites", {
      workspaceId,
      email,
      tokenHash: "hash",
      createdBy: ownerId,
      expiresAt: Date.now() + 7 * DAY,
      ...fields,
    }),
  );
}

describe("invite-only sign-up guard", () => {
  beforeEach(() => stubAuthEnv());
  afterEach(() => vi.unstubAllEnvs());

  it("lets the first person sign up while the instance has no members", async () => {
    const t = setupTest({ withAuth: true });
    const res = await signUp(t, "first@example.com");
    expect(res.status).toBe(200);
  });

  it("rejects a sign-up without an invite once a member exists", async () => {
    const t = setupTest({ withAuth: true });
    await seedOwner(t);
    const res = await signUp(t, "stranger@example.com");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toMatch(/invite-only/i);
    const user = await t.run((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "email", value: "stranger@example.com" }],
      }),
    );
    expect(user).toBeNull();
  });

  it("allows a sign-up with a pending invite, matching email case-insensitively", async () => {
    const t = setupTest({ withAuth: true });
    await seedInvite(t, "partner@example.com");
    const res = await signUp(t, "Partner@Example.com");
    expect(res.status).toBe(200);
  });

  it.each([
    ["expired", { expiresAt: Date.now() - DAY }],
    ["revoked", { revokedAt: Date.now() - 1000 }],
    ["already accepted", { acceptedAt: Date.now() - 1000 }],
  ])("rejects a sign-up whose only invite is %s", async (_label, fields) => {
    const t = setupTest({ withAuth: true });
    await seedInvite(t, "partner@example.com", fields);
    const res = await signUp(t, "partner@example.com");
    expect(res.status).toBe(403);
  });

  it("rejects a sign-up when the invite is for a different email", async () => {
    const t = setupTest({ withAuth: true });
    await seedInvite(t, "partner@example.com");
    const res = await signUp(t, "someone-else@example.com");
    expect(res.status).toBe(403);
  });
});

describe("createAuth", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails with a clear message when BETTER_AUTH_SECRET is missing", () => {
    stubAuthEnv({ BETTER_AUTH_SECRET: undefined });
    expect(() => createAuth({} as never)).toThrow(MISSING_SECRET_MESSAGE);
  });
});
