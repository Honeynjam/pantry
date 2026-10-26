import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { brand } from "./lib/brand";
import { SAMPLE_CONTEXT_DOC } from "./lib/defaults";
import { setupTest, type TestConvex } from "./test.setup";

const owner = { subject: "user-owner", name: "Kris", email: "kris@example.com" };
const outsider = { subject: "user-outsider", name: "Out", email: "out@example.com" };

async function setUp() {
  const t = setupTest();
  const created = await t.withIdentity(owner).mutation(api.setup.createWorkspace, { workspaceName: "Home" });
  return { t, as: t.withIdentity(owner), ...created };
}

/** A second workspace with its own member, to check nothing crosses over. */
async function otherWorkspace(t: TestConvex) {
  return t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", { name: "Other", slug: "other", createdBy: outsider.subject });
    await ctx.db.insert("members", { workspaceId, userId: outsider.subject, displayName: "Out", role: "owner" });
    const spaceId = await ctx.db.insert("spaces", { workspaceId, name: "Other", key: "OTH", nextIssueNumber: 1 });
    const labelId = await ctx.db.insert("labels", { workspaceId, name: "Theirs", color: "red" });
    return { workspaceId, spaceId, labelId };
  });
}

async function seedIssue(
  t: TestConvex,
  fields: { workspaceId: Id<"workspaces">; spaceId: Id<"spaces">; memberId: Id<"members">; labelIds: Id<"labels">[] },
) {
  return t.run(async (ctx) => {
    const status = await ctx.db
      .query("statuses")
      .withIndex("by_workspace_and_order", (q) => q.eq("workspaceId", fields.workspaceId))
      .first();
    const number = Math.floor(Math.random() * 1e6);
    return ctx.db.insert("issues", {
      workspaceId: fields.workspaceId,
      spaceId: fields.spaceId,
      number,
      key: `PAN-${number}`,
      title: "Seeded",
      description: "",
      statusId: status!._id,
      statusCategory: status!.category,
      priority: 0,
      creatorId: fields.memberId,
      labelIds: fields.labelIds,
      sortOrder: 1,
      updatedAt: 1,
    });
  });
}

describe("spaces", () => {
  it("creates a space with its context doc", async () => {
    const { t, as } = await setUp();
    const { spaceId, key } = await as.mutation(api.spaces.create, { name: "  Web   app ", key: "web" });
    expect(key).toBe("WEB");
    const current = await as.query(api.workspace.current, {});
    expect(current.spaces.map((p) => [p.name, p.key, p.nextIssueNumber])).toContainEqual(["Web app", "WEB", 1]);
    const doc = await as.query(api.docs.getContext, { spaceId });
    expect(doc?.body).toBe(SAMPLE_CONTEXT_DOC);
    expect(await t.run((ctx) => ctx.db.query("docs").collect())).toHaveLength(2);
  });

  it("keeps keys unique per workspace, archived spaces included", async () => {
    const { as, spaceId } = await setUp();
    await expect(as.mutation(api.spaces.create, { name: "Dup", key: brand.defaultKey })).rejects.toThrow(
      /already the key/,
    );
    await as.mutation(api.spaces.archive, { spaceId });
    await expect(as.mutation(api.spaces.create, { name: "Dup", key: brand.defaultKey.toLowerCase() })).rejects.toThrow(
      /archived space/,
    );
  });

  it("allows the same key in another workspace", async () => {
    const { t, as } = await setUp();
    await otherWorkspace(t);
    await expect(t.withIdentity(outsider).mutation(api.spaces.create, { name: "Mine", key: "WEB" })).resolves.toBeTruthy();
    await expect(as.mutation(api.spaces.create, { name: "Web", key: "WEB" })).resolves.toBeTruthy();
  });

  it.each(["P", "1AB", "AB-C", "ABCDEFGHIJK", ""])("rejects the key %j", async (key) => {
    const { as } = await setUp();
    await expect(as.mutation(api.spaces.create, { name: "X", key })).rejects.toThrow(/Keys are 2–10/);
  });

  it("renames and archives, but never across workspaces", async () => {
    const { t, as, spaceId } = await setUp();
    await as.mutation(api.spaces.update, { spaceId, name: "Renamed" });
    const other = await otherWorkspace(t);
    await expect(as.mutation(api.spaces.update, { spaceId: other.spaceId, name: "Mine now" })).rejects.toThrow(
      /not found/,
    );
    await expect(as.mutation(api.spaces.archive, { spaceId: other.spaceId })).rejects.toThrow(/not found/);
    await as.mutation(api.spaces.archive, { spaceId });
    const current = await as.query(api.workspace.current, {});
    expect(current.spaces).toEqual([]);
    const archived = await t.run((ctx) => ctx.db.get("spaces", spaceId));
    expect(archived).toMatchObject({ name: "Renamed", key: brand.defaultKey });
  });
});

describe("labels", () => {
  it("creates, renames and recolours with unique names", async () => {
    const { as } = await setUp();
    const labelId = await as.mutation(api.labels.create, { name: "Bug", color: "red" });
    await expect(as.mutation(api.labels.create, { name: "bug", color: "blue" })).rejects.toThrow(/already a label/);
    await expect(as.mutation(api.labels.create, { name: "Css", color: "url(x)" })).rejects.toThrow(/palette/);
    await as.mutation(api.labels.update, { labelId, name: "Defect", color: "#aabbcc" });
    const current = await as.query(api.workspace.current, {});
    expect(current.labels.map((l) => [l.name, l.color])).toEqual([["Defect", "#aabbcc"]]);
  });

  it("removal pulls the label from every issue's labelIds, with an activity row each", async () => {
    const { t, as, workspaceId, spaceId, memberId } = await setUp();
    const bug = await as.mutation(api.labels.create, { name: "Bug", color: "red" });
    const ui = await as.mutation(api.labels.create, { name: "UI", color: "blue" });
    const both = await seedIssue(t, { workspaceId, spaceId, memberId, labelIds: [bug, ui] });
    const onlyBug = await seedIssue(t, { workspaceId, spaceId, memberId, labelIds: [bug] });
    const untouched = await seedIssue(t, { workspaceId, spaceId, memberId, labelIds: [ui] });

    await as.mutation(api.labels.remove, { labelId: bug });

    const issues = await t.run(async (ctx) => Promise.all([both, onlyBug, untouched].map((id) => ctx.db.get("issues", id))));
    expect(issues.map((issue) => issue!.labelIds)).toEqual([[ui], [], [ui]]);
    expect(issues[0]!.updatedAt).toBeGreaterThan(1);
    expect(issues[2]!.updatedAt).toBe(1);
    const activity = await t.run((ctx) => ctx.db.query("activity").collect());
    expect(activity.map((row) => [row.issueId, row.type, row.from, row.to])).toEqual([
      [both, "labels_changed", "Bug, UI", "UI"],
      [onlyBug, "labels_changed", "Bug", ""],
    ]);
    const current = await as.query(api.workspace.current, {});
    expect(current.labels.map((l) => l.name)).toEqual(["UI"]);
  });

  it("can't touch another workspace's labels", async () => {
    const { t, as } = await setUp();
    const other = await otherWorkspace(t);
    await expect(as.mutation(api.labels.remove, { labelId: other.labelId })).rejects.toThrow(/not found/);
    await expect(as.mutation(api.labels.update, { labelId: other.labelId, name: "Mine" })).rejects.toThrow(/not found/);
  });
});

describe("statuses", () => {
  it("reorders all six", async () => {
    const { as } = await setUp();
    const before = (await as.query(api.workspace.current, {})).statuses;
    const reversed = [...before].reverse().map((status) => status._id);
    await as.mutation(api.statuses.reorder, { statusIds: reversed });
    const after = (await as.query(api.workspace.current, {})).statuses;
    expect(after.map((status) => status._id)).toEqual(reversed);
    expect(after.map((status) => status.order)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("rejects a partial, duplicated or foreign order", async () => {
    const { t, as } = await setUp();
    const ids = (await as.query(api.workspace.current, {})).statuses.map((status) => status._id);
    await expect(as.mutation(api.statuses.reorder, { statusIds: ids.slice(1) })).rejects.toThrow(/exactly once/);
    await expect(as.mutation(api.statuses.reorder, { statusIds: [ids[0]!, ...ids.slice(0, 5)] })).rejects.toThrow(
      /exactly once/,
    );
    const other = await otherWorkspace(t);
    const foreign = await t.run(async (ctx) => {
      return ctx.db.insert("statuses", { workspaceId: other.workspaceId, name: "X", category: "done", order: 0, color: "red" });
    });
    await expect(as.mutation(api.statuses.reorder, { statusIds: [...ids.slice(1), foreign] })).rejects.toThrow(
      /exactly once/,
    );
  });

  it("renames and recolours, keeping names unique and the category fixed", async () => {
    const { as } = await setUp();
    const [backlog, todo] = (await as.query(api.workspace.current, {})).statuses;
    await as.mutation(api.statuses.update, { statusId: todo!._id, name: "Up next", color: "blue" });
    await expect(as.mutation(api.statuses.update, { statusId: backlog!._id, name: "up NEXT" })).rejects.toThrow(
      /already a status/,
    );
    const after = (await as.query(api.workspace.current, {})).statuses[1];
    expect(after).toMatchObject({ name: "Up next", color: "blue", category: "unstarted" });
  });
});

describe("docs", () => {
  it("saves the context doc and records who did it", async () => {
    const { as, spaceId, memberId } = await setUp();
    await as.mutation(api.docs.saveContext, { spaceId, body: "# New\n\nBody\n" });
    const doc = await as.query(api.docs.getContext, { spaceId });
    expect(doc).toMatchObject({ body: "# New\n\nBody\n", updatedBy: { _id: memberId, displayName: "Kris" } });
  });

  it("is scoped to the caller's workspace", async () => {
    const { t, as } = await setUp();
    const other = await otherWorkspace(t);
    await expect(as.query(api.docs.getContext, { spaceId: other.spaceId })).rejects.toThrow(/not found/);
    await expect(as.mutation(api.docs.saveContext, { spaceId: other.spaceId, body: "x" })).rejects.toThrow(
      /not found/,
    );
  });
});
