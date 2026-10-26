import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { brand } from "./lib/brand";
import { setupTest } from "./test.setup";

const owner = { subject: "user-owner", name: "Kris", email: "kris@example.com" };

describe("workspace.current", () => {
  it("returns the shell data for a member", async () => {
    const t = setupTest();
    await t.withIdentity(owner).mutation(api.setup.createWorkspace, { workspaceName: "Home" });
    const current = await t.withIdentity(owner).query(api.workspace.current, {});
    expect(current.workspace.name).toBe("Home");
    expect(current.me).toMatchObject({ userId: owner.subject, role: "owner" });
    expect(current.statuses.map((s) => s.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(current.members).toHaveLength(1);
    expect(current.labels).toEqual([]);
    expect(current.projects.map((p) => p.key)).toEqual([brand.defaultKey]);
  });

  it("hides archived projects", async () => {
    const t = setupTest();
    const { projectId } = await t.withIdentity(owner).mutation(api.setup.createWorkspace, {});
    await t.run((ctx) => ctx.db.patch("projects", projectId, { archivedAt: Date.now() }));
    const current = await t.withIdentity(owner).query(api.workspace.current, {});
    expect(current.projects).toEqual([]);
  });

  it("rejects signed-out callers and non-members", async () => {
    const t = setupTest();
    await t.withIdentity(owner).mutation(api.setup.createWorkspace, {});
    await expect(t.query(api.workspace.current, {})).rejects.toThrow(/Sign in first/);
    await expect(t.withIdentity({ subject: "stranger" }).query(api.workspace.current, {})).rejects.toThrow(
      /not a member/,
    );
  });
});
