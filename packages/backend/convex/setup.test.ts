import { describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import { requireMember } from "./lib/auth";
import { DEFAULT_STATUSES, SAMPLE_CONTEXT_DOC, slugify } from "./lib/defaults";
import { brand } from "./lib/brand";
import { setupTest } from "./test.setup";

const owner = { subject: "user-owner", name: "Kris", email: "kris@example.com" };

describe("setup.createWorkspace", () => {
  it("bootstraps the workspace on first run", async () => {
    const t = setupTest();
    expect(await t.query(api.setup.status, {})).toMatchObject({ needsSetup: true });

    const asOwner = t.withIdentity(owner);
    const result = await asOwner.mutation(api.setup.createWorkspace, { workspaceName: "Home" });

    const data = await t.run(async (ctx) => ({
      workspaces: await ctx.db.query("workspaces").collect(),
      members: await ctx.db.query("members").collect(),
      statuses: await ctx.db
        .query("statuses")
        .withIndex("by_workspace_and_order", (q) => q.eq("workspaceId", result.workspaceId))
        .collect(),
      projects: await ctx.db.query("projects").collect(),
      docs: await ctx.db.query("docs").collect(),
    }));

    expect(data.workspaces).toHaveLength(1);
    expect(data.workspaces[0]).toMatchObject({ name: "Home", slug: "home", createdBy: owner.subject });

    expect(data.members).toHaveLength(1);
    expect(data.members[0]).toMatchObject({
      _id: result.memberId,
      workspaceId: result.workspaceId,
      userId: owner.subject,
      displayName: "Kris",
      role: "owner",
    });

    expect(data.statuses.map((s) => [s.name, s.category, s.order])).toEqual([
      ["Backlog", "backlog", 0],
      ["Todo", "unstarted", 1],
      ["In Progress", "started", 2],
      ["In Review", "review", 3],
      ["Done", "done", 4],
      ["Canceled", "canceled", 5],
    ]);
    expect(data.statuses.map((s) => s.color)).toEqual(DEFAULT_STATUSES.map((s) => s.color));

    expect(data.projects).toHaveLength(1);
    expect(data.projects[0]).toMatchObject({
      _id: result.projectId,
      workspaceId: result.workspaceId,
      key: brand.defaultKey,
      nextIssueNumber: 1,
    });
    expect(data.projects[0]?.archivedAt).toBeUndefined();

    expect(data.docs).toHaveLength(1);
    expect(data.docs[0]).toMatchObject({
      workspaceId: result.workspaceId,
      projectId: result.projectId,
      kind: "project_context",
      body: SAMPLE_CONTEXT_DOC,
      updatedBy: result.memberId,
    });

    // The owner now passes the member check every app function starts with.
    const me = await asOwner.run((ctx) => requireMember(ctx));
    expect(me._id).toBe(result.memberId);
    expect(await t.query(api.setup.status, {})).toMatchObject({ needsSetup: false });
  });

  it("rejects a second run, from anyone", async () => {
    const t = setupTest();
    await t.withIdentity(owner).mutation(api.setup.createWorkspace, {});

    await expect(
      t.withIdentity({ subject: "user-second" }).mutation(api.setup.createWorkspace, {}),
    ).rejects.toThrow(/already has a workspace/);
    await expect(t.withIdentity(owner).mutation(api.setup.createWorkspace, {})).rejects.toThrow(
      /already has a workspace/,
    );

    const counts = await t.run(async (ctx) => ({
      workspaces: (await ctx.db.query("workspaces").collect()).length,
      members: (await ctx.db.query("members").collect()).length,
      statuses: (await ctx.db.query("statuses").collect()).length,
      projects: (await ctx.db.query("projects").collect()).length,
    }));
    expect(counts).toEqual({ workspaces: 1, members: 1, statuses: 6, projects: 1 });
  });

  it("requires a signed-in user", async () => {
    const t = setupTest();
    await expect(t.mutation(api.setup.createWorkspace, {})).rejects.toThrow(/Sign in first/);
    expect(await t.query(api.setup.status, {})).toMatchObject({ needsSetup: true });
  });

  it("derives names from the identity when none are given", async () => {
    const t = setupTest();
    await t.withIdentity(owner).mutation(api.setup.createWorkspace, {});
    const workspace = await t.run((ctx) => ctx.db.query("workspaces").first());
    expect(workspace).toMatchObject({ name: "Kris's workspace", slug: "kriss-workspace" });
  });
});

describe("slugify", () => {
  it.each([
    ["Home", "home"],
    ["Kris's workspace", "kriss-workspace"],
    ["  Café Ünïcode!! ", "cafe-unicode"],
    ["***", "workspace"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe("setup.status", () => {
  it("reports a missing BETTER_AUTH_SECRET", async () => {
    const t = setupTest();
    vi.stubEnv("BETTER_AUTH_SECRET", undefined);
    expect(await t.query(api.setup.status, {})).toMatchObject({ needsSecret: true });
    vi.stubEnv("BETTER_AUTH_SECRET", "set");
    expect(await t.query(api.setup.status, {})).toMatchObject({ needsSecret: false });
    vi.unstubAllEnvs();
  });

  it("tells signed-in non-members apart from members", async () => {
    const t = setupTest();
    expect(await t.query(api.setup.status, {})).toMatchObject({ signedIn: false, isMember: false });
    const stranger = t.withIdentity({ subject: "user-stranger" });
    expect(await stranger.query(api.setup.status, {})).toMatchObject({ signedIn: true, isMember: false });
    await t.withIdentity(owner).mutation(api.setup.createWorkspace, {});
    expect(await t.withIdentity(owner).query(api.setup.status, {})).toMatchObject({
      needsSetup: false,
      signedIn: true,
      isMember: true,
    });
    expect(await stranger.query(api.setup.status, {})).toMatchObject({ isMember: false });
  });
});
