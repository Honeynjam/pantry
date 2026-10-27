import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { createIssue, updateIssue } from "./lib/issues";
import { resolveProjectByName, resolveSpaceByKey } from "./lib/spaces";
import { setupTest, type TestConvex } from "./test.setup";

const owner = { subject: "user-owner", name: "Kris", email: "kris@example.com" };
const outsider = { subject: "user-outsider", name: "Out", email: "out@example.com" };

async function setUp() {
  const t = setupTest();
  const created = await t
    .withIdentity(owner)
    .mutation(api.setup.createWorkspace, { workspaceName: "Home" });
  const as = t.withIdentity(owner);
  const web = await as.mutation(api.spaces.create, { name: "Website", key: "WEB" });
  const project = (name: string, spaceId: Id<"spaces"> = created.spaceId, color?: string) =>
    as.mutation(api.projects.create, { spaceId, name, ...(color ? { color } : {}) });
  const issue = (
    title: string,
    extra: {
      projectId?: Id<"projects"> | null;
      parentId?: Id<"issues">;
      spaceId?: Id<"spaces">;
    } = {},
  ) => as.mutation(api.issues.create, { spaceId: created.spaceId, title, ...extra });
  return { t, as, ...created, webId: web.spaceId, project, issue };
}

/** The user-facing message of a ConvexError thrown by a helper (inside t.run). */
async function messageOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    return (err as { data?: { message?: string } }).data?.message ?? String(err);
  }
  throw new Error("expected an error");
}

const getIssue = (t: TestConvex, issueId: Id<"issues">) =>
  t.run((ctx) => ctx.db.get("issues", issueId));
const activityOf = (t: TestConvex, issueId: Id<"issues">) =>
  t.run((ctx) =>
    ctx.db
      .query("activity")
      .withIndex("by_issue", (q) => q.eq("issueId", issueId))
      .collect(),
  );

/** A second workspace with a space, a project and an issue of its own. */
async function otherWorkspace(t: TestConvex) {
  return t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Other",
      slug: "other",
      createdBy: outsider.subject,
    });
    const memberId = await ctx.db.insert("members", {
      workspaceId,
      userId: outsider.subject,
      displayName: "Out",
      role: "owner",
    });
    const spaceId = await ctx.db.insert("spaces", {
      workspaceId,
      name: "Other",
      key: "OTH",
      nextIssueNumber: 2,
    });
    const projectId = await ctx.db.insert("projects", {
      workspaceId,
      spaceId,
      name: "Secret",
      sortOrder: 1,
    });
    const statusId = await ctx.db.insert("statuses", {
      workspaceId,
      name: "Todo",
      category: "unstarted",
      order: 0,
      color: "gray",
    });
    const issueId = await ctx.db.insert("issues", {
      workspaceId,
      spaceId,
      projectId,
      number: 1,
      key: "OTH-1",
      title: "Theirs",
      description: "",
      statusId,
      statusCategory: "unstarted",
      priority: 0,
      creatorId: memberId,
      labelIds: [],
      sortOrder: 1,
      updatedAt: 0,
    });
    return { workspaceId, spaceId, projectId, issueId };
  });
}

describe("projects", () => {
  it("are created in a space, in order, with unique names per space (ignoring case)", async () => {
    const { as, spaceId, webId, project } = await setUp();
    await project("LinkedIn", spaceId, "blue");
    await project("  Launch   plan ");
    await expect(project("linkedin")).rejects.toThrow(/already a project called LinkedIn/);
    await project("LinkedIn", webId); // another space: fine
    const current = await as.query(api.workspace.current, {});
    expect(
      current.projects
        .filter((p) => p.spaceId === spaceId)
        .map((p) => [p.name, p.color, p.sortOrder]),
    ).toEqual([
      ["LinkedIn", "blue", 1],
      ["Launch plan", undefined, 2],
    ]);
    await expect(project("Bad colour", spaceId, "url(x)")).rejects.toThrow(/palette/);
  });

  it("rename, recolour and reorder", async () => {
    const { as, spaceId, project } = await setUp();
    const a = await project("A", spaceId, "red");
    const b = await project("B");
    await expect(as.mutation(api.projects.update, { projectId: b, name: "a" })).rejects.toThrow(
      /already a project/,
    );
    await as.mutation(api.projects.update, { projectId: a, name: "Alpha", color: null });
    await as.mutation(api.projects.reorder, { spaceId, projectIds: [b, a] });
    await expect(as.mutation(api.projects.reorder, { spaceId, projectIds: [b] })).rejects.toThrow(
      /each of the space's projects once/,
    );
    const current = await as.query(api.workspace.current, {});
    expect(current.projects.map((p) => [p.name, p.color])).toEqual([
      ["B", undefined],
      ["Alpha", undefined],
    ]);
  });

  it("archiving leaves every issue in the space with no project, with an activity row each", async () => {
    const { t, as, spaceId, project, issue } = await setUp();
    const launch = await project("Launch");
    const parent = await issue("Parent", { projectId: launch });
    const child = await issue("Child", { parentId: parent.issueId });
    const other = await issue("Not in it");
    const before = (await getIssue(t, parent.issueId))!.updatedAt;

    await as.mutation(api.projects.archive, { projectId: launch });

    for (const id of [parent.issueId, child.issueId]) {
      const row = (await getIssue(t, id))!;
      expect(row.projectId).toBeUndefined();
      expect(row.spaceId).toBe(spaceId);
      const changes = (await activityOf(t, id)).filter((a) => a.type === "project_changed");
      expect(changes.map((a) => [a.from, a.to])).toEqual([["Launch", undefined]]);
    }
    expect((await getIssue(t, parent.issueId))!.updatedAt).toBeGreaterThanOrEqual(before);
    expect((await activityOf(t, other.issueId)).map((a) => a.type)).toEqual(["created"]);
    // Still listed in the space; the project is gone from the shell and from pickers.
    const list = await as.query(api.issues.listBySpace, { spaceId });
    expect(list.map((row) => row.title).sort()).toEqual(["Child", "Not in it", "Parent"]);
    expect((await as.query(api.workspace.current, {})).projects).toEqual([]);
    await expect(issue("Into archived", { projectId: launch })).rejects.toThrow(/archived/);
    // Its name is free again.
    await expect(project("Launch")).resolves.toBeTruthy();
  });
});

describe("issues in projects", () => {
  it("rejects a project from another space, on create and update", async () => {
    const { as, webId, project, issue } = await setUp();
    const webProject = await project("Homepage", webId);
    await expect(issue("Wrong space", { projectId: webProject })).rejects.toThrow(
      /project in another space/,
    );
    const plain = await issue("Plain");
    await expect(
      as.mutation(api.issues.update, { issueId: plain.issueId, projectId: webProject }),
    ).rejects.toThrow(/project in another space/);
    await expect(
      as.query(api.issues.listBySpace, {
        spaceId: (await as.query(api.workspace.current, {})).spaces[0]!._id,
        projectId: webProject,
      }),
    ).rejects.toThrow(/not found/);
  });

  it("sets and clears the project with one project_changed row each", async () => {
    const { t, as, spaceId, project, issue } = await setUp();
    const a = await project("Alpha");
    const b = await project("Beta");
    const { issueId } = await issue("Moving", { projectId: a });
    await as.mutation(api.issues.update, { issueId, projectId: b });
    await as.mutation(api.issues.update, { issueId, projectId: b }); // no change, no row
    await as.mutation(api.issues.update, { issueId, projectId: null });
    const rows = (await activityOf(t, issueId)).filter((row) => row.type === "project_changed");
    expect(rows.map((row) => [row.from, row.to])).toEqual([
      ["Alpha", "Beta"],
      ["Beta", undefined],
    ]);
    expect((await getIssue(t, issueId))!.projectId).toBeUndefined();
    await as.mutation(api.issues.update, { issueId, projectId: a });
    expect(
      (await as.query(api.issues.listBySpace, { spaceId, projectId: a })).map((row) => row.title),
    ).toEqual(["Moving"]);
    expect(await as.query(api.issues.listBySpace, { spaceId, projectId: b })).toEqual([]);
  });

  it("sub-issues inherit the parent's space and project (app path)", async () => {
    const { t, as, webId, project, issue } = await setUp();
    const launch = await project("Launch");
    const other = await project("Other");
    const parent = await issue("Parent", { projectId: launch });

    const child = await issue("Child", { parentId: parent.issueId });
    expect(await getIssue(t, child.issueId)).toMatchObject({
      projectId: launch,
      parentId: parent.issueId,
    });
    await expect(
      issue("Wrong project", { parentId: parent.issueId, projectId: other }),
    ).rejects.toThrow(/parent's project/);
    await expect(
      issue("No project", { parentId: parent.issueId, projectId: null }),
    ).rejects.toThrow(/parent's project/);
    await expect(
      issue("Wrong space", { parentId: parent.issueId, spaceId: webId }),
    ).rejects.toThrow(/parent's space/);

    // A sub-issue can't pick its own project; moving the parent moves its sub-issues.
    await expect(
      as.mutation(api.issues.update, { issueId: child.issueId, projectId: other }),
    ).rejects.toThrow(/Change PAN-1's project instead/);
    await as.mutation(api.issues.update, { issueId: parent.issueId, projectId: other });
    expect((await getIssue(t, child.issueId))!.projectId).toBe(other);
    expect(
      (await activityOf(t, child.issueId))
        .filter((r) => r.type === "project_changed")
        .map((r) => [r.from, r.to]),
    ).toEqual([["Launch", "Other"]]);

    // Getting a parent brings its project along.
    const loose = await issue("Loose");
    await as.mutation(api.issues.update, { issueId: loose.issueId, parentId: parent.issueId });
    expect(await getIssue(t, loose.issueId)).toMatchObject({
      parentId: parent.issueId,
      projectId: other,
    });
  });

  it("sub-issues inherit the parent's space and project through the shared helper (the MCP path)", async () => {
    const { t, spaceId, webId, project, issue } = await setUp();
    const launch = await project("Launch");
    const other = await project("Other");
    const parent = await issue("Parent", { projectId: launch });
    await t.run(async (ctx) => {
      const member = (await ctx.db.query("members").first())!;
      const actor = { member, via: "mcp" as const };
      const { issueId } = await createIssue(ctx, actor, {
        title: "Agent child",
        parentId: parent.issueId,
      });
      const child = (await ctx.db.get("issues", issueId))!;
      expect(child).toMatchObject({ spaceId, projectId: launch });
      await expect(
        createIssue(ctx, actor, { title: "x", parentId: parent.issueId, projectId: other }),
      ).rejects.toThrow(/parent's project/);
      await expect(
        createIssue(ctx, actor, { title: "x", parentId: parent.issueId, spaceId: webId }),
      ).rejects.toThrow(/parent's space/);
      await expect(updateIssue(ctx, actor, child, { projectId: other })).rejects.toThrow(
        /parent's project/,
      );
      const rows = await ctx.db
        .query("activity")
        .withIndex("by_issue", (q) => q.eq("issueId", issueId))
        .collect();
      expect(rows.map((row) => [row.type, row.via])).toEqual([["created", "mcp"]]);
    });
  });
});

describe("MCP lookups by name", () => {
  it("finds a space by key and a project by name, any case, and lists the valid ones otherwise", async () => {
    const { t, as, workspaceId, spaceId, project } = await setUp();
    const linkedin = await project("LinkedIn");
    const archived = await project("Old stuff");
    await as.mutation(api.projects.archive, { projectId: archived });
    await project("Marketing");
    await t.run(async (ctx) => {
      const space = await resolveSpaceByKey(ctx, workspaceId, " pan ");
      expect(space._id).toBe(spaceId);
      expect(await messageOf(resolveSpaceByKey(ctx, workspaceId, "NOPE"))).toBe(
        'No space with the key "NOPE". Spaces: PAN, WEB.',
      );

      expect((await resolveProjectByName(ctx, space, "  linkedIN "))?._id).toBe(linkedin);
      expect(await resolveProjectByName(ctx, space, "None")).toBeNull();
      expect(await messageOf(resolveProjectByName(ctx, space, "Sales"))).toBe(
        'No project "Sales" in PAN. Projects in PAN: LinkedIn, Marketing (or "none").',
      );
      // Archived projects can't be found by name.
      expect(await messageOf(resolveProjectByName(ctx, space, "Old stuff"))).toContain(
        "Projects in PAN: LinkedIn, Marketing",
      );
      const web = await resolveSpaceByKey(ctx, workspaceId, "web");
      expect(await messageOf(resolveProjectByName(ctx, web, "LinkedIn"))).toBe(
        'WEB has no projects yet. Use "none" or leave the project out.',
      );
    });
  });
});

describe("workspace isolation for spaces and projects", () => {
  it("returns not found for another workspace's space, project or issue", async () => {
    const { t, as, workspaceId, spaceId, issue } = await setUp();
    const theirs = await otherWorkspace(t);
    const mine = await issue("Mine");

    await expect(
      as.mutation(api.projects.create, { spaceId: theirs.spaceId, name: "Sneaky" }),
    ).rejects.toThrow(/Space not found/);
    await expect(
      as.mutation(api.projects.update, { projectId: theirs.projectId, name: "Mine now" }),
    ).rejects.toThrow(/Project not found/);
    await expect(
      as.mutation(api.projects.archive, { projectId: theirs.projectId }),
    ).rejects.toThrow(/Project not found/);
    await expect(
      as.mutation(api.projects.reorder, {
        spaceId: theirs.spaceId,
        projectIds: [theirs.projectId],
      }),
    ).rejects.toThrow(/Space not found/);
    await expect(issue("Into theirs", { projectId: theirs.projectId })).rejects.toThrow(
      /Project not found/,
    );
    await expect(
      as.mutation(api.issues.update, { issueId: mine.issueId, projectId: theirs.projectId }),
    ).rejects.toThrow(/Project not found/);
    await expect(
      as.mutation(api.issues.create, { spaceId: theirs.spaceId, title: "x" }),
    ).rejects.toThrow(/Space not found/);
    await expect(as.query(api.issues.listBySpace, { spaceId: theirs.spaceId })).rejects.toThrow(
      /not found/,
    );
    await expect(
      as.query(api.issues.listBySpace, { spaceId, projectId: theirs.projectId }),
    ).rejects.toThrow(/not found/);
    await expect(
      as.mutation(api.spaces.update, { spaceId: theirs.spaceId, name: "x" }),
    ).rejects.toThrow(/Space not found/);
    await expect(as.query(api.docs.getContext, { spaceId: theirs.spaceId })).rejects.toThrow(
      /not found/,
    );
    expect(await as.query(api.issues.search, { text: "OTH-1" })).toEqual([]);
    expect(await as.query(api.issues.search, { text: "Theirs" })).toEqual([]);

    await t.run(async (ctx) => {
      await expect(resolveSpaceByKey(ctx, workspaceId, "OTH")).rejects.toThrow(
        /No space with the key/,
      );
      const member = (await ctx.db.query("members").first())!;
      await expect(
        createIssue(ctx, { member, via: "mcp" }, { spaceId: theirs.spaceId, title: "x" }),
      ).rejects.toThrow(/Space not found/);
      await expect(
        createIssue(
          ctx,
          { member, via: "mcp" },
          { spaceId, title: "x", projectId: theirs.projectId },
        ),
      ).rejects.toThrow(/Project not found/);
    });
    // Their data is untouched.
    expect((await t.run((ctx) => ctx.db.get("issues", theirs.issueId)))?.projectId).toBe(
      theirs.projectId,
    );
  });
});

describe("spaces", () => {
  it("have a kind, product unless set", async () => {
    const { as, spaceId } = await setUp();
    const client = await as.mutation(api.spaces.create, {
      name: "Acme Ltd",
      key: "ACME",
      kind: "client",
    });
    await as.mutation(api.spaces.update, { spaceId, kind: "product" });
    const { spaces } = await as.query(api.workspace.current, {});
    expect(spaces.map((space) => [space.key, space.kind ?? "product"])).toEqual([
      ["PAN", "product"],
      ["WEB", "product"],
      ["ACME", "client"],
    ]);
    expect(spaces.find((space) => space._id === client.spaceId)?.kind).toBe("client");
  });

  it("bootstrap creates the sample space with no projects", async () => {
    const { as } = await setUp();
    const current = await as.query(api.workspace.current, {});
    expect(current.spaces[0]).toMatchObject({ key: "PAN", nextIssueNumber: 1 });
    expect(current.projects).toEqual([]);
  });
});
