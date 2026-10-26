import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { RECENT_DONE_MS } from "./issues";
import { MIN_GAP } from "./lib/issues";
import { setupTest, type TestConvex } from "./test.setup";

const owner = { subject: "user-owner", name: "Kris", email: "kris@example.com" };
const partner = { subject: "user-partner", name: "Partner", email: "partner@example.com" };

async function setUp() {
  const t = setupTest();
  const created = await t.withIdentity(owner).mutation(api.setup.createWorkspace, { workspaceName: "Home" });
  const partnerId = await t.run((ctx) =>
    ctx.db.insert("members", {
      workspaceId: created.workspaceId,
      userId: partner.subject,
      displayName: "Partner",
      role: "member",
    }),
  );
  const as = t.withIdentity(owner);
  const current = await as.query(api.workspace.current, {});
  const status = Object.fromEntries(current.statuses.map((s) => [s.category, s._id])) as Record<
    "backlog" | "unstarted" | "started" | "review" | "done" | "canceled",
    Id<"statuses">
  >;
  const create = (title: string, extra: Partial<Parameters<typeof as.mutation<typeof api.issues.create>>[1]> = {}) =>
    as.mutation(api.issues.create, { projectId: created.projectId, title, ...extra });
  return { t, as, ...created, partnerId, status, create };
}

const activityOf = (t: TestConvex, issueId: Id<"issues">) =>
  t.run((ctx) =>
    ctx.db
      .query("activity")
      .withIndex("by_issue", (q) => q.eq("issueId", issueId))
      .collect(),
  );

const getIssue = (t: TestConvex, issueId: Id<"issues">) => t.run((ctx) => ctx.db.get("issues", issueId));

afterEach(() => vi.useRealTimers());

describe("issues.create", () => {
  it("numbers issues without gaps or duplicates under repeated creates", async () => {
    const { t, as, create, projectId } = await setUp();
    const keys: string[] = [];
    for (let i = 0; i < 12; i++) keys.push((await create(`Issue ${i}`)).key);
    // Concurrent creates are serialised by Convex's transactions; none share a number.
    const parallel = await Promise.all(Array.from({ length: 8 }, (_, i) => create(`Parallel ${i}`)));
    keys.push(...parallel.map((result) => result.key));
    expect(new Set(keys).size).toBe(20);
    expect(keys.map((key) => Number(key.split("-")[1])).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    const project = await t.run((ctx) => ctx.db.get("projects", projectId));
    expect(project?.nextIssueNumber).toBe(21);
    const fetched = await as.query(api.issues.get, { key: "pan-3" });
    expect(fetched?.issue.title).toBe("Issue 2");
  });

  it("defaults to Todo, no priority, the top of its column and one created row", async () => {
    const { t, create, status, memberId } = await setUp();
    const first = await create("First");
    const second = await create("Second");
    const [a, b] = [await getIssue(t, first.issueId), await getIssue(t, second.issueId)];
    expect(a).toMatchObject({ statusId: status.unstarted, statusCategory: "unstarted", priority: 0, labelIds: [], description: "" });
    expect(a?.creatorId).toBe(memberId);
    expect(b!.sortOrder).toBe(a!.sortOrder - 1);
    expect((await activityOf(t, first.issueId)).map((row) => [row.type, row.to, row.via])).toEqual([
      ["created", "Todo", "app"],
    ]);
  });

  it("sets completedAt when created in a done or canceled status", async () => {
    const { t, create, status } = await setUp();
    const { issueId } = await create("Already done", { statusId: status.done });
    expect((await getIssue(t, issueId))?.completedAt).toBeTypeOf("number");
  });

  it("validates title, due date, assignee and labels", async () => {
    const { t, create, partnerId } = await setUp();
    await expect(create("   ")).rejects.toThrow(/title/);
    await expect(create("x".repeat(201))).rejects.toThrow(/200/);
    await expect(create("Bad day", { dueDate: "2026-02-30" })).rejects.toThrow(/calendar days/);
    const { issueId } = await create("Good", { dueDate: "2026-10-28", assigneeId: partnerId, priority: 2 });
    expect(await getIssue(t, issueId)).toMatchObject({ dueDate: "2026-10-28", assigneeId: partnerId, priority: 2 });
  });

  it("rejects archived projects", async () => {
    const { as, create, projectId } = await setUp();
    await as.mutation(api.projects.archive, { projectId });
    await expect(create("Nope")).rejects.toThrow(/archived/);
  });
});

describe("sub-issues", () => {
  it("inherit the parent's project and reject a different one", async () => {
    const { t, as, create } = await setUp();
    const parent = await create("Parent");
    const web = await as.mutation(api.projects.create, { name: "Web", key: "WEB" });
    await expect(create("Wrong project", { parentId: parent.issueId, projectId: web.projectId })).rejects.toThrow(
      /parent's project/,
    );
    // Through the shared helper, any projectId matching the parent works and the key follows it.
    const child = await create("Child", { parentId: parent.issueId });
    expect(child.key).toBe("PAN-2");
    expect((await getIssue(t, child.issueId))?.parentId).toBe(parent.issueId);
  });

  it("are one level deep", async () => {
    const { create } = await setUp();
    const parent = await create("Parent");
    const child = await create("Child", { parentId: parent.issueId });
    await expect(create("Grandchild", { parentId: child.issueId })).rejects.toThrow(/already a sub-issue/);
  });

  it("can't loop or nest through update", async () => {
    const { as, create } = await setUp();
    const a = await create("A");
    const b = await create("B");
    const c = await create("C");
    await expect(as.mutation(api.issues.update, { issueId: a.issueId, parentId: a.issueId })).rejects.toThrow(
      /own parent/,
    );
    await as.mutation(api.issues.update, { issueId: b.issueId, parentId: a.issueId });
    // A has a sub-issue now, so it can't become one.
    await expect(as.mutation(api.issues.update, { issueId: a.issueId, parentId: c.issueId })).rejects.toThrow(
      /has sub-issues/,
    );
    // B is a sub-issue, so nothing can go under it.
    await expect(as.mutation(api.issues.update, { issueId: c.issueId, parentId: b.issueId })).rejects.toThrow(
      /already a sub-issue/,
    );
    // Unparenting works, and then A can go under C.
    await as.mutation(api.issues.update, { issueId: b.issueId, parentId: null });
    await as.mutation(api.issues.update, { issueId: a.issueId, parentId: c.issueId });
  });

  it("can't take a parent from another project through update", async () => {
    const { as, create } = await setUp();
    const web = await as.mutation(api.projects.create, { name: "Web", key: "WEB" });
    const parent = await as.mutation(api.issues.create, { projectId: web.projectId, title: "Web parent" });
    const issue = await create("PAN issue");
    await expect(as.mutation(api.issues.update, { issueId: issue.issueId, parentId: parent.issueId })).rejects.toThrow(
      /same project/,
    );
  });
});

describe("issues.update", () => {
  it("writes one activity row per changed field and none for unchanged ones", async () => {
    const { t, as, create, partnerId } = await setUp();
    const parent = await create("Parent");
    const { issueId } = await create("Title");
    const bug = await as.mutation(api.labels.create, { name: "Bug", color: "red" });
    const ui = await as.mutation(api.labels.create, { name: "UI", color: "blue" });
    const before = await getIssue(t, issueId);

    vi.useFakeTimers({ now: Date.now() + 1000 });
    await as.mutation(api.issues.update, {
      issueId,
      title: "New title",
      description: "Some **markdown**",
      priority: 1,
      assigneeId: partnerId,
      labelIds: [bug, ui],
      dueDate: "2026-11-02",
      parentId: parent.issueId,
    });
    const rows = (await activityOf(t, issueId)).slice(1);
    expect(rows.map((row) => [row.type, row.from, row.to])).toEqual([
      ["title_changed", "Title", "New title"],
      ["description_changed", undefined, undefined],
      ["priority_changed", "0", "1"],
      ["assigned", undefined, "Partner"],
      ["labels_changed", "", "Bug, UI"],
      ["due_date_changed", undefined, "2026-11-02"],
      ["parent_changed", undefined, "PAN-1"],
    ]);
    const after = await getIssue(t, issueId);
    expect(after!.updatedAt).toBeGreaterThan(before!.updatedAt);

    // Same values again (labels in another order): nothing changes, no rows, no updatedAt bump.
    await as.mutation(api.issues.update, {
      issueId,
      title: " New   title ",
      priority: 1,
      assigneeId: partnerId,
      labelIds: [ui, bug],
      dueDate: "2026-11-02",
      parentId: parent.issueId,
    });
    expect(await activityOf(t, issueId)).toHaveLength(8);
    expect((await getIssue(t, issueId))!.updatedAt).toBe(after!.updatedAt);

    // Clearing fields: one row each.
    await as.mutation(api.issues.update, { issueId, assigneeId: null, dueDate: null, parentId: null, labelIds: [ui] });
    const cleared = (await activityOf(t, issueId)).slice(8);
    expect(cleared.map((row) => [row.type, row.from, row.to])).toEqual([
      ["assigned", "Partner", undefined],
      ["labels_changed", "Bug, UI", "UI"],
      ["due_date_changed", "2026-11-02", undefined],
      ["parent_changed", "PAN-1", undefined],
    ]);
    const final = await getIssue(t, issueId);
    expect(final).toMatchObject({ labelIds: [ui] });
    expect(final?.assigneeId).toBeUndefined();
    expect(final?.dueDate).toBeUndefined();
    expect(final?.parentId).toBeUndefined();
  });

  it("never changes status", async () => {
    const { t, as, create, status } = await setUp();
    const { issueId } = await create("Stays");
    // The validator doesn't accept statusId at all.
    await expect(
      as.mutation(api.issues.update, { issueId, statusId: status.done } as never),
    ).rejects.toThrow();
    expect((await getIssue(t, issueId))?.statusId).toBe(status.unstarted);
  });
});

describe("issues.move", () => {
  it("sets and clears completedAt by category, with one status_changed row per change", async () => {
    const { t, as, create, status } = await setUp();
    const { issueId } = await create("Lifecycle");
    const move = (statusId: Id<"statuses">) => as.mutation(api.issues.move, { issueId, statusId });

    await move(status.started);
    const started = await getIssue(t, issueId);
    expect(started?.statusCategory).toBe("started");
    expect(started?.completedAt).toBeUndefined();
    await move(status.done);
    const done = await getIssue(t, issueId);
    expect(done?.statusCategory).toBe("done");
    expect(done?.completedAt).toBeTypeOf("number");
    // Done → Canceled keeps the original completion time.
    await move(status.canceled);
    expect((await getIssue(t, issueId))?.completedAt).toBe(done?.completedAt);
    await move(status.review);
    expect((await getIssue(t, issueId))?.completedAt).toBeUndefined();

    const rows = (await activityOf(t, issueId)).filter((row) => row.type === "status_changed");
    expect(rows.map((row) => [row.from, row.to])).toEqual([
      ["Todo", "In Progress"],
      ["In Progress", "Done"],
      ["Done", "Canceled"],
      ["Canceled", "In Review"],
    ]);
  });

  it("puts a moved issue at the top of the new column, or between the given neighbours", async () => {
    const { t, as, create, status } = await setUp();
    const ids: Id<"issues">[] = [];
    for (const title of ["A", "B", "C"]) ids.push((await create(title, { statusId: status.started })).issueId);
    // Created at the top each time: column order is C, B, A.
    const order = async () =>
      (await as.query(api.issues.listByProject, { projectId: (await getIssue(t, ids[0]!))!.projectId }))
        .filter((issue) => issue.statusId === status.started)
        .map((issue) => issue.title);
    expect(await order()).toEqual(["C", "B", "A"]);

    const { issueId: d } = await create("D");
    await as.mutation(api.issues.move, { issueId: d, statusId: status.started });
    expect(await order()).toEqual(["D", "C", "B", "A"]);
    await as.mutation(api.issues.move, { issueId: d, statusId: status.started, afterId: ids[1] }); // after B
    expect(await order()).toEqual(["C", "B", "D", "A"]);
    await as.mutation(api.issues.move, { issueId: d, statusId: status.started, beforeId: ids[2] }); // before C
    expect(await order()).toEqual(["D", "C", "B", "A"]);
    await as.mutation(api.issues.move, { issueId: d, statusId: status.started, afterId: ids[0] }); // after A (last)
    expect(await order()).toEqual(["C", "B", "A", "D"]);
    // Reordering inside a column writes no activity row.
    expect((await activityOf(t, d)).map((row) => row.type)).toEqual(["created", "status_changed"]);
  });

  it("renumbers the column when the gap between neighbours drops below 1e-9", async () => {
    const { t, as, create, status } = await setUp();
    const a = await create("A", { statusId: status.review });
    const b = await create("B", { statusId: status.review });
    const c = await create("C", { statusId: status.review });
    // Squeeze A and B together: B at 5, A at 5 + MIN_GAP / 2.
    await t.run(async (ctx) => {
      await ctx.db.patch("issues", c.issueId, { sortOrder: 1 });
      await ctx.db.patch("issues", b.issueId, { sortOrder: 5 });
      await ctx.db.patch("issues", a.issueId, { sortOrder: 5 + MIN_GAP / 2 });
    });
    const { issueId: d } = await create("D");
    await as.mutation(api.issues.move, { issueId: d, statusId: status.review, afterId: b.issueId, beforeId: a.issueId });
    const rows = await t.run((ctx) => Promise.all([c, b, { issueId: d }, a].map((row) => ctx.db.get("issues", row.issueId))));
    expect(rows.map((row) => row!.sortOrder)).toEqual([1, 2, 3, 4]);
  });

  it("keeps working after many midpoint moves (repeated halving)", async () => {
    const { t, as, create, status } = await setUp();
    const top = await create("Top", { statusId: status.backlog });
    const bottom = await create("Bottom", { statusId: status.backlog });
    // Column: Bottom (top), Top. Keep inserting right after Bottom to halve the same gap.
    const inserted: Id<"issues">[] = [];
    for (let i = 0; i < 45; i++) {
      const { issueId } = await create(`Mid ${i}`);
      await as.mutation(api.issues.move, { issueId, statusId: status.backlog, afterId: bottom.issueId });
      inserted.push(issueId);
    }
    const column = (await as.query(api.issues.listByProject, { projectId: (await getIssue(t, top.issueId))!.projectId }))
      .filter((issue) => issue.statusId === status.backlog);
    const orders = column.map((issue) => issue.sortOrder);
    expect([...orders].sort((x, y) => x - y)).toEqual(orders);
    expect(new Set(orders).size).toBe(orders.length);
    expect(column[0]!._id).toBe(bottom.issueId);
    expect(column[1]!._id).toBe(inserted[inserted.length - 1]);
    expect(column[column.length - 1]!._id).toBe(top.issueId);
  });

  it("rejects statuses from another workspace", async () => {
    const { t, as, create } = await setUp();
    const { issueId } = await create("Mine");
    const foreign = await t.run(async (ctx) => {
      const workspaceId = await ctx.db.insert("workspaces", { name: "Other", slug: "other", createdBy: "x" });
      return ctx.db.insert("statuses", { workspaceId, name: "Done", category: "done", order: 0, color: "red" });
    });
    await expect(as.mutation(api.issues.move, { issueId, statusId: foreign })).rejects.toThrow(/not found/);
  });
});

describe("issues.listByProject / listMine / get / remove", () => {
  it("orders by status then sortOrder and hides old done issues unless asked", async () => {
    const { t, as, create, status, projectId } = await setUp();
    const old = await create("Old done", { statusId: status.done });
    await t.run((ctx) => ctx.db.patch("issues", old.issueId, { completedAt: Date.now() - RECENT_DONE_MS - 1000 }));
    await create("Recent done", { statusId: status.done });
    await create("Backlog item", { statusId: status.backlog });
    await create("Todo item");
    const titles = (await as.query(api.issues.listByProject, { projectId })).map((issue) => issue.title);
    expect(titles).toEqual(["Backlog item", "Todo item", "Recent done"]);
    const all = (await as.query(api.issues.listByProject, { projectId, includeDone: true })).map((issue) => issue.title);
    expect(all).toEqual(["Backlog item", "Todo item", "Recent done", "Old done"]);
  });

  it("lists my open issues", async () => {
    const { t, as, create, status, memberId, partnerId } = await setUp();
    await create("Mine todo", { assigneeId: memberId });
    await create("Mine done", { assigneeId: memberId, statusId: status.done });
    await create("Mine backlog", { assigneeId: memberId, statusId: status.backlog });
    await create("Theirs", { assigneeId: partnerId });
    await create("Mine review", { assigneeId: memberId, statusId: status.review });
    const mine = (await as.query(api.issues.listMine, {})).map((issue) => issue.title).sort();
    expect(mine).toEqual(["Mine review", "Mine todo"]);
    const theirs = await t.withIdentity(partner).query(api.issues.listMine, {});
    expect(theirs.map((issue) => issue.title)).toEqual(["Theirs"]);
  });

  it("gets an issue with sub-issues, comments and activity", async () => {
    const { as, create } = await setUp();
    const parent = await create("Parent");
    await create("Child", { parentId: parent.issueId });
    await as.mutation(api.comments.add, { issueId: parent.issueId, body: "First!" });
    const result = await as.query(api.issues.get, { key: parent.key });
    expect(result?.subIssues.map((issue) => issue.title)).toEqual(["Child"]);
    expect(result?.comments.map((comment) => [comment.body, comment.via])).toEqual([["First!", "app"]]);
    expect(result?.activity.map((row) => row.type)).toEqual(["created", "commented"]);
    const child = await as.query(api.issues.get, { key: "PAN-2" });
    expect(child?.parent?.key).toBe("PAN-1");
    expect(await as.query(api.issues.get, { key: "PAN-99" })).toBeNull();
  });

  it("removes an issue with its comments, activity and sub-issues", async () => {
    const { t, as, create } = await setUp();
    const parent = await create("Parent");
    const child = await create("Child", { parentId: parent.issueId });
    const other = await create("Other");
    await as.mutation(api.comments.add, { issueId: child.issueId, body: "On the child" });
    await as.mutation(api.issues.remove, { issueId: parent.issueId });
    const left = await t.run(async (ctx) => ({
      issues: (await ctx.db.query("issues").collect()).map((issue) => issue._id),
      comments: await ctx.db.query("comments").collect(),
      activity: (await ctx.db.query("activity").collect()).map((row) => row.issueId),
    }));
    expect(left.issues).toEqual([other.issueId]);
    expect(left.comments).toEqual([]);
    expect(left.activity).toEqual([other.issueId]);
  });

  it("keeps every function inside the caller's workspace", async () => {
    const { t, create } = await setUp();
    const { issueId } = await create("Private");
    const stranger = { subject: "stranger" };
    await t.run(async (ctx) => {
      const workspaceId = await ctx.db.insert("workspaces", { name: "Other", slug: "other", createdBy: "stranger" });
      await ctx.db.insert("members", { workspaceId, userId: "stranger", displayName: "S", role: "owner" });
    });
    const them = t.withIdentity(stranger);
    await expect(them.mutation(api.issues.update, { issueId, title: "Mine" })).rejects.toThrow(/not found/);
    await expect(them.mutation(api.issues.remove, { issueId })).rejects.toThrow(/not found/);
    await expect(them.mutation(api.comments.add, { issueId, body: "hi" })).rejects.toThrow(/not found/);
    expect(await them.query(api.issues.get, { key: "PAN-1" })).toBeNull();
  });
});

describe("comments", () => {
  it("adds with an activity row and updatedAt; only the author edits or removes", async () => {
    const { t, as, create } = await setUp();
    const { issueId } = await create("Talk");
    const before = (await getIssue(t, issueId))!.updatedAt;
    vi.useFakeTimers({ now: Date.now() + 1000 });
    const commentId = await as.mutation(api.comments.add, { issueId, body: "Hello" });
    expect((await getIssue(t, issueId))!.updatedAt).toBeGreaterThan(before);
    await expect(as.mutation(api.comments.add, { issueId, body: "   " })).rejects.toThrow(/Write something/);

    const them = t.withIdentity(partner);
    await expect(them.mutation(api.comments.edit, { commentId, body: "Hijack" })).rejects.toThrow(/Only the author/);
    await expect(them.mutation(api.comments.remove, { commentId })).rejects.toThrow(/Only the author/);

    await as.mutation(api.comments.edit, { commentId, body: "Hello again" });
    const edited = await t.run((ctx) => ctx.db.get("comments", commentId));
    expect(edited).toMatchObject({ body: "Hello again" });
    expect(edited?.editedAt).toBeTypeOf("number");
    await as.mutation(api.comments.remove, { commentId });
    expect(await t.run((ctx) => ctx.db.get("comments", commentId))).toBeNull();
  });
});
