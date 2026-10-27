import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { resolveSpaceByKey } from "./lib/spaces";
import { setupTest, type TestConvex } from "./test.setup";

const owner = { subject: "user-owner", name: "Kris", email: "kris@example.com" };
const partner = { subject: "user-partner", name: "Partner", email: "partner@example.com" };

/**
 * An M2-shaped workspace as the M2 code wrote it (rows inserted directly, since the M2 functions
 * are gone): PAN with 30 issues incl. sub-issues, an archived OLD project, comments, activity and
 * context docs. Plus rows the Spaces release already wrote: a WEB space with a workstream, issues
 * in it and its doc; a space for OLD left by a crashed half-run; a dangling project ref.
 */
async function seedMixed(t: TestConvex) {
  return t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Home",
      slug: "home",
      createdBy: owner.subject,
    });
    const ownerId = await ctx.db.insert("members", {
      workspaceId,
      userId: owner.subject,
      displayName: "Kris",
      role: "owner",
    });
    const partnerId = await ctx.db.insert("members", {
      workspaceId,
      userId: partner.subject,
      displayName: "Partner",
      role: "member",
    });
    const todo = await ctx.db.insert("statuses", {
      workspaceId,
      name: "Todo",
      category: "unstarted",
      order: 0,
      color: "gray",
    });
    const done = await ctx.db.insert("statuses", {
      workspaceId,
      name: "Done",
      category: "done",
      order: 1,
      color: "green",
    });
    const labelId = await ctx.db.insert("labels", { workspaceId, name: "Bug", color: "red" });

    // M2 rows: products lived in `projects`.
    const pan = await ctx.db.insert("projects", {
      workspaceId,
      name: "Pantry",
      key: "PAN",
      nextIssueNumber: 31,
    });
    const old = await ctx.db.insert("projects", {
      workspaceId,
      name: "Old",
      key: "OLD",
      nextIssueNumber: 3,
      archivedAt: 1,
    });
    const issue = (
      projectId: Id<"projects"> | undefined,
      key: string,
      number: number,
      extra: Record<string, unknown> = {},
    ) =>
      ctx.db.insert("issues", {
        workspaceId,
        ...(projectId ? { projectId } : {}),
        number,
        key,
        title: `Issue ${key}`,
        description: `Body of ${key}`,
        statusId: number % 2 ? todo : done,
        statusCategory: number % 2 ? "unstarted" : "done",
        priority: 2,
        creatorId: ownerId,
        assigneeId: number % 3 ? ownerId : partnerId,
        labelIds: number % 4 ? [] : [labelId],
        sortOrder: number,
        updatedAt: 1000 + number,
        ...extra,
      });
    const panIssues: Id<"issues">[] = [];
    for (let n = 1; n <= 30; n++) {
      // PAN-21…PAN-30 are sub-issues of PAN-1…PAN-10.
      panIssues.push(
        await issue(pan, `PAN-${n}`, n, n > 20 ? { parentId: panIssues[n - 21] } : {}),
      );
    }
    const oldIssues = [await issue(old, "OLD-1", 1), await issue(old, "OLD-2", 2)];
    for (const [index, issueId] of panIssues.slice(0, 5).entries()) {
      await ctx.db.insert("comments", {
        issueId,
        authorId: index % 2 ? partnerId : ownerId,
        body: `Comment ${index}`,
        via: "app",
      });
    }
    for (const issueId of [...panIssues, ...oldIssues]) {
      await ctx.db.insert("activity", {
        workspaceId,
        issueId,
        actorId: ownerId,
        type: "created",
        to: "Todo",
        via: "app",
      });
    }
    const panDoc = await ctx.db.insert("docs", {
      workspaceId,
      projectId: pan,
      kind: "project_context",
      title: "Pantry context",
      body: "# PAN context\n\nWritten in M2.\n",
      updatedBy: ownerId,
      updatedAt: 5,
    });
    const oldDoc = await ctx.db.insert("docs", {
      workspaceId,
      projectId: old,
      kind: "project_context",
      title: "Old context",
      body: "old",
      updatedBy: ownerId,
      updatedAt: 6,
    });

    // Rows the Spaces release already wrote.
    const web = await ctx.db.insert("spaces", {
      workspaceId,
      name: "Website",
      key: "WEB",
      nextIssueNumber: 3,
    });
    const launch = await ctx.db.insert("projects", {
      workspaceId,
      spaceId: web,
      name: "Launch",
      sortOrder: 1,
    });
    const webIssue = await issue(launch, "WEB-1", 1, { spaceId: web });
    const webPlain = await issue(undefined, "WEB-2", 2, { spaceId: web });
    await ctx.db.insert("docs", {
      workspaceId,
      spaceId: web,
      kind: "space_context",
      title: "Web",
      body: "web",
      updatedBy: ownerId,
      updatedAt: 7,
    });
    // A crashed half-run already made OLD's space (as step 1 writes it), but with a stale counter.
    const oldSpace = await ctx.db.insert("spaces", {
      workspaceId,
      name: "Old",
      key: "OLD",
      nextIssueNumber: 2,
      archivedAt: 1,
    });
    // A dangling ref: an issue that has its space but points at a project row that's gone.
    const gone = await ctx.db.insert("projects", {
      workspaceId,
      spaceId: web,
      name: "Gone",
      sortOrder: 2,
    });
    const dangling = await issue(gone, "WEB-3", 3, { spaceId: web });
    await ctx.db.delete("projects", gone);

    return {
      workspaceId,
      ownerId,
      partnerId,
      pan,
      old,
      panIssues,
      oldIssues,
      panDoc,
      oldDoc,
      web,
      launch,
      webIssue,
      webPlain,
      oldSpace,
      dangling,
    };
  });
}

/** Everything but the tables the migration may change, to prove those stay untouched. */
const snapshot = (t: TestConvex) =>
  t.run(async (ctx) => ({
    issues: await ctx.db.query("issues").collect(),
    comments: await ctx.db.query("comments").collect(),
    activity: await ctx.db.query("activity").collect(),
    docs: await ctx.db.query("docs").collect(),
    spaces: await ctx.db.query("spaces").collect(),
    projects: await ctx.db.query("projects").collect(),
    members: await ctx.db.query("members").collect(),
  }));

describe("the M2 → Spaces migration", () => {
  it("moves M2 projects, issues and docs to spaces, in small batches, and keeps everything else", async () => {
    const t = setupTest();
    const seed = await seedMixed(t);
    const before = await snapshot(t);
    const as = t.withIdentity(owner);

    // Before: the guard refuses, and the app knows an upgrade is pending.
    await expect(t.query(internal.migrations.assertMigrated, {})).rejects.toThrow(
      /Not migrated yet: 2 M2 projects, 32 issues without a space, 2 context docs without a space/,
    );
    expect((await as.query(api.workspace.current, {})).upgrading).toBe(true);
    await t.run(async (ctx) => {
      await expect(resolveSpaceByKey(ctx, seed.workspaceId, "PAN")).rejects.toThrow(
        /finishing an upgrade/,
      );
    });

    // A batch size of 7 makes every step take several pages.
    const summary = await t.action(internal.migrations.run, { batchSize: 7 });
    expect(summary).toEqual({
      spacesCreated: 1, // PAN; OLD's space was already there
      spacesExisting: 1,
      issuesMigrated: 32,
      issuesUnchanged: 2, // WEB-1, WEB-2
      danglingProjectRefsCleared: 1, // WEB-3
      docsMigrated: 2,
      docsUnchanged: 1,
      legacyProjectsDeleted: 2,
      problems: [],
    });

    const after = await snapshot(t);
    const pan = after.spaces.find((space) => space.key === "PAN")!;
    const old = after.spaces.find((space) => space.key === "OLD")!;
    expect(pan).toMatchObject({
      workspaceId: seed.workspaceId,
      name: "Pantry",
      nextIssueNumber: 31,
    });
    expect(pan.archivedAt).toBeUndefined();
    expect(old).toMatchObject({ _id: seed.oldSpace, nextIssueNumber: 3, archivedAt: 1 }); // reused, counter raised
    expect(after.spaces).toHaveLength(3);
    // Only the workstream is left in `projects`.
    expect(after.projects.map((row) => row._id)).toEqual([seed.launch]);

    // Issues: same rows, same keys and fields, now with their space and without the M2 project.
    expect(after.issues).toHaveLength(before.issues.length);
    for (const row of after.issues) {
      const was = before.issues.find((issue) => issue._id === row._id)!;
      const { spaceId, projectId, ...rest } = row;
      const { spaceId: _wasSpace, projectId: _wasProject, ...wasRest } = was;
      expect(rest).toEqual(wasRest);
      if (row.key.startsWith("PAN-"))
        expect({ spaceId, projectId }).toEqual({ spaceId: pan._id, projectId: undefined });
      if (row.key.startsWith("OLD-"))
        expect({ spaceId, projectId }).toEqual({ spaceId: old._id, projectId: undefined });
    }
    expect(after.issues.find((row) => row._id === seed.webIssue)).toMatchObject({
      spaceId: seed.web,
      projectId: seed.launch,
    });
    expect(after.issues.find((row) => row._id === seed.dangling)?.projectId).toBeUndefined();
    // Sub-issues still point at their parents.
    expect(
      after.issues
        .filter((row) => row.parentId)
        .map((row) => row.key)
        .sort(),
    ).toEqual(Array.from({ length: 10 }, (_, i) => `PAN-${i + 21}`).sort());

    // Comments, activity and members untouched.
    expect(after.comments).toEqual(before.comments);
    expect(after.activity).toEqual(before.activity);
    expect(after.members).toEqual(before.members);

    // Docs keep their body, now on the space.
    const panDoc = after.docs.find((doc) => doc._id === seed.panDoc)!;
    expect(panDoc).toMatchObject({
      spaceId: pan._id,
      kind: "space_context",
      body: "# PAN context\n\nWritten in M2.\n",
    });
    expect(panDoc.projectId).toBeUndefined();
    expect(await as.query(api.docs.getContext, { spaceId: pan._id })).toMatchObject({
      body: "# PAN context\n\nWritten in M2.\n",
    });

    // The app sees it all, and numbering carries on.
    const current = await as.query(api.workspace.current, {});
    expect(current.upgrading).toBe(false);
    // OLD was archived in M2 and stays archived as a space.
    expect(current.spaces.map((space) => space.key).sort()).toEqual(["PAN", "WEB"]);
    const list = await as.query(api.issues.listBySpace, { spaceId: pan._id, includeDone: true });
    expect(list).toHaveLength(30);
    const created = await as.mutation(api.issues.create, {
      spaceId: pan._id,
      title: "After the upgrade",
    });
    expect(created.key).toBe("PAN-31");
    const sub = await as.query(api.issues.get, { key: "PAN-21" });
    expect(sub?.parent?.key).toBe("PAN-1");
    expect(sub?.space?.key).toBe("PAN");
    expect(sub?.project).toBeNull();

    expect(await t.query(internal.migrations.assertMigrated, {})).toEqual({
      ok: true,
      legacyProjects: 0,
      issuesWithoutSpace: 0,
      legacyDocs: 0,
    });
  });

  it("changes nothing when run again", async () => {
    const t = setupTest();
    await seedMixed(t);
    await t.action(internal.migrations.run, {});
    const once = await snapshot(t);
    const again = await t.action(internal.migrations.run, { batchSize: 3 });
    expect(again).toEqual({
      spacesCreated: 0,
      spacesExisting: 0,
      issuesMigrated: 0,
      issuesUnchanged: 35,
      danglingProjectRefsCleared: 0,
      docsMigrated: 0,
      docsUnchanged: 3,
      legacyProjectsDeleted: 0,
      problems: [],
    });
    expect(await snapshot(t)).toEqual(once);
  });

  it("is a no-op on a workspace that never had M2 data", async () => {
    const t = setupTest();
    await t.withIdentity(owner).mutation(api.setup.createWorkspace, {});
    const before = await snapshot(t);
    const summary = await t.action(internal.migrations.run, {});
    expect(
      summary.issuesMigrated +
        summary.spacesCreated +
        summary.docsMigrated +
        summary.legacyProjectsDeleted,
    ).toBe(0);
    expect(await snapshot(t)).toEqual(before);
  });

  it("migrates everything it can, then fails loudly on rows it can't place", async () => {
    const t = setupTest();
    const seed = await seedMixed(t);
    // An M2 issue whose project row is gone: there's no way to know its space.
    await t.run(async (ctx) => {
      const lost = await ctx.db.insert("projects", {
        workspaceId: seed.workspaceId,
        name: "Lost",
        key: "LOST",
        nextIssueNumber: 2,
      });
      const issue = (await ctx.db.get("issues", seed.panIssues[0]!))!;
      const { _id, _creationTime, ...fields } = issue;
      void _id;
      void _creationTime;
      await ctx.db.insert("issues", {
        ...fields,
        key: "LOST-1",
        projectId: lost,
        parentId: undefined,
      });
      await ctx.db.delete("projects", lost);
    });
    await expect(t.action(internal.migrations.run, {})).rejects.toThrow(
      /Issue LOST-1 has no space and its project is gone/,
    );
    // Everything else moved.
    const left = await t.query(internal.migrations.status, {});
    expect(left).toEqual({ legacyProjects: 0, issuesWithoutSpace: 1, legacyDocs: 0 });
    await expect(t.query(internal.migrations.assertMigrated, {})).rejects.toThrow(
      /1 issues without a space/,
    );
  });
});
