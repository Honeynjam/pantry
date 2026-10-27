// Perf seed for a LOCAL deployment only. scripts/perf/seed.sh copies this file into
// packages/backend/convex/devSeed.ts, runs it, and deletes it again; it is never committed there
// (packages/backend/.gitignore) and never deployed.
//
// Fills the (already set up) workspace with realistic volume: 3 spaces, projects, labels, and
// thousands of issues with descriptions, sub-issues, comments and activity. Most done/canceled
// issues are completed weeks ago, as in a real tracker that has been used for a while.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";

const DAY = 24 * 60 * 60 * 1000;
const WORDS =
  "sidebar board list filter palette shortcut status label member invite token agent migration space project issue comment activity search sync offline cursor selection drag column render bundle query index cache theme motion spring keyboard focus dialog picker".split(
    " ",
  );

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function sentence(rand: () => number, words: number) {
  const out: string[] = [];
  for (let i = 0; i < words; i++) out.push(WORDS[Math.floor(rand() * WORDS.length)]!);
  const text = out.join(" ");
  return text[0]!.toUpperCase() + text.slice(1);
}

function description(rand: () => number) {
  if (rand() < 0.15) return "";
  const parts = [`## Context\n\n${sentence(rand, 30)}.\n\n${sentence(rand, 25)}.`];
  if (rand() < 0.7)
    parts.push(
      `## Steps\n\n- ${sentence(rand, 8)}\n- ${sentence(rand, 10)}\n- [ ] ${sentence(rand, 6)}`,
    );
  if (rand() < 0.4)
    parts.push(
      '```ts\nconst issue = await ctx.db.get("issues", id);\nif (!issue) return notFound("Issue");\n```',
    );
  if (rand() < 0.5) parts.push(`${sentence(rand, 40)}. ${sentence(rand, 30)}.`);
  return parts.join("\n\n");
}

export const info = internalQuery({
  args: {},
  handler: async (ctx) => {
    const workspace = await ctx.db.query("workspaces").first();
    if (!workspace) throw new Error("Set up the workspace in the browser first");
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .collect();
    const statuses = await ctx.db
      .query("statuses")
      .withIndex("by_workspace_and_order", (q) => q.eq("workspaceId", workspace._id))
      .collect();
    return { workspaceId: workspace._id, memberIds: members.map((m) => m._id), statuses };
  },
});

export const structure = internalMutation({
  args: {},
  handler: async (ctx) => {
    const workspace = (await ctx.db.query("workspaces").first())!;
    const workspaceId = workspace._id;
    const existing = await ctx.db
      .query("spaces")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const wanted = [
      { key: "PAN", name: "Pantry" },
      { key: "WEB", name: "Website" },
      { key: "OPS", name: "Client: Acme" },
    ];
    const spaces: Id<"spaces">[] = [];
    for (const want of wanted) {
      const found = existing.find((space) => space.key === want.key);
      spaces.push(
        found?._id ??
          (await ctx.db.insert("spaces", {
            workspaceId,
            name: want.name,
            key: want.key,
            nextIssueNumber: 1,
            kind: "product",
          })),
      );
    }
    const projects: Id<"projects">[][] = [];
    for (const [index, spaceId] of spaces.entries()) {
      const rows = await ctx.db
        .query("projects")
        .withIndex("by_space", (q) => q.eq("spaceId", spaceId))
        .collect();
      const ids = rows.map((row) => row._id);
      const names = [["Launch", "MCP", "Desktop"], ["Landing", "Docs"], ["Retainer"]][index]!;
      for (const [order, name] of names.entries()) {
        if (rows.some((row) => row.name === name)) continue;
        ids.push(
          await ctx.db.insert("projects", { workspaceId, spaceId, name, sortOrder: order + 1 }),
        );
      }
      projects.push(ids);
    }
    const labels = await ctx.db
      .query("labels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const labelIds = labels.map((label) => label._id);
    for (const [name, color] of [
      ["bug", "red"],
      ["feature", "blue"],
      ["perf", "orange"],
      ["design", "purple"],
      ["chore", "gray"],
    ] as const) {
      if (labels.some((label) => label.name === name)) continue;
      labelIds.push(await ctx.db.insert("labels", { workspaceId, name, color }));
    }
    const done: number[] = [];
    for (const id of spaces) done.push((await ctx.db.get("spaces", id))!.nextIssueNumber - 1);
    return { spaces, projects, labelIds, done };
  },
});

export const batch = internalMutation({
  args: {
    spaceId: v.id("spaces"),
    projectIds: v.array(v.id("projects")),
    labelIds: v.array(v.id("labels")),
    memberIds: v.array(v.id("members")),
    count: v.number(),
    seed: v.number(),
    openShare: v.number(),
  },
  handler: async (ctx, args) => {
    const rand = rng(args.seed);
    const space = (await ctx.db.get("spaces", args.spaceId))!;
    const statuses = await ctx.db
      .query("statuses")
      .withIndex("by_workspace_and_order", (q) => q.eq("workspaceId", space.workspaceId))
      .collect();
    const open = statuses.filter((s) => s.category !== "done" && s.category !== "canceled");
    const done = statuses.find((s) => s.category === "done")!;
    const canceled = statuses.find((s) => s.category === "canceled")!;
    const now = Date.now();
    let number = space.nextIssueNumber;
    const recentParents: Doc<"issues">[] = [];
    for (let i = 0; i < args.count; i++) {
      const isOpen = rand() < args.openShare;
      const status: Doc<"statuses"> = isOpen
        ? open[Math.floor(rand() * open.length)]!
        : rand() < 0.85
          ? done
          : canceled;
      const age = isOpen
        ? rand() * 60 * DAY
        : rand() < 0.93
          ? 15 * DAY + rand() * 300 * DAY
          : rand() * 13 * DAY;
      const parent =
        recentParents.length > 0 && rand() < 0.12
          ? recentParents[Math.floor(rand() * recentParents.length)]!
          : undefined;
      const projectId = parent
        ? parent.projectId
        : rand() < 0.6
          ? args.projectIds[Math.floor(rand() * args.projectIds.length)]
          : undefined;
      const labelIds = args.labelIds.filter(() => rand() < 0.22);
      const assigneeId =
        rand() < 0.7 ? args.memberIds[Math.floor(rand() * args.memberIds.length)] : undefined;
      const updatedAt = now - age;
      const id = await ctx.db.insert("issues", {
        workspaceId: space.workspaceId,
        spaceId: space._id,
        ...(projectId ? { projectId } : {}),
        number,
        key: `${space.key}-${number}`,
        title: sentence(rand, 4 + Math.floor(rand() * 7)),
        description: description(rand),
        statusId: status._id,
        statusCategory: status.category,
        priority: Math.floor(rand() * 5) as 0 | 1 | 2 | 3 | 4,
        ...(assigneeId ? { assigneeId } : {}),
        creatorId: args.memberIds[0]!,
        labelIds,
        ...(parent ? { parentId: parent._id } : {}),
        ...(rand() < 0.2
          ? { dueDate: new Date(now + (rand() - 0.3) * 60 * DAY).toISOString().slice(0, 10) }
          : {}),
        sortOrder: number + rand(),
        ...(isOpen ? {} : { completedAt: updatedAt }),
        updatedAt,
      });
      number += 1;
      if (!parent && rand() < 0.3) {
        const doc = (await ctx.db.get("issues", id))!;
        recentParents.push(doc);
        if (recentParents.length > 20) recentParents.shift();
      }
      const actor = assigneeId ?? args.memberIds[0]!;
      await ctx.db.insert("activity", {
        workspaceId: space.workspaceId,
        issueId: id,
        actorId: actor,
        type: "created",
        to: "Todo",
        via: "app",
      });
      const extra = Math.floor(rand() * 5);
      for (let a = 0; a < extra; a++) {
        await ctx.db.insert("activity", {
          workspaceId: space.workspaceId,
          issueId: id,
          actorId: actor,
          type: "status_changed",
          from: "Todo",
          to: status.name,
          via: rand() < 0.3 ? "mcp" : "app",
        });
      }
      const comments = rand() < 0.5 ? Math.floor(rand() * 6) : 0;
      for (let c = 0; c < comments; c++) {
        await ctx.db.insert("comments", {
          issueId: id,
          authorId: args.memberIds[Math.floor(rand() * args.memberIds.length)]!,
          body: `${sentence(rand, 12)}.\n\n${sentence(rand, 20)}.`,
          via: rand() < 0.3 ? "mcp" : "app",
        });
      }
    }
    await ctx.db.patch("spaces", space._id, { nextIssueNumber: number });
    return number;
  },
});

/** `npx convex run devSeed:run '{"scale":1}'`: PAN 1,500, WEB 800, OPS 300 issues at scale 1. */
export const run = internalAction({
  args: { scale: v.optional(v.number()) },
  handler: async (ctx, { scale = 1 }): Promise<{ spaces: number }> => {
    const { memberIds }: { memberIds: Id<"members">[] } = await ctx.runQuery(
      internal.devSeed.info,
      {},
    );
    const {
      spaces,
      projects,
      labelIds,
      done,
    }: {
      spaces: Id<"spaces">[];
      projects: Id<"projects">[][];
      labelIds: Id<"labels">[];
      done: number[];
    } = await ctx.runMutation(internal.devSeed.structure, {});
    const plan = [
      { count: 1500, openShare: 0.34 },
      { count: 800, openShare: 0.3 },
      { count: 300, openShare: 0.5 },
    ];
    let seed = 1;
    for (const [index, spaceId] of spaces.entries()) {
      // Resumable: only what's missing. Paced to stay under the local backend's write limit.
      let left = Math.round(plan[index]!.count * scale) - done[index]!;
      while (left > 0) {
        const count = Math.min(100, left);
        await new Promise((resolve) => setTimeout(resolve, 600));
        await ctx.runMutation(internal.devSeed.batch, {
          spaceId,
          projectIds: projects[index]!,
          labelIds,
          memberIds,
          count,
          seed: seed++,
          openShare: plan[index]!.openShare,
        });
        left -= count;
      }
    }
    return { spaces: spaces.length };
  },
});

/** Empties every table (leave local data empty when done). */
export const wipe = internalMutation({
  args: { table: v.string() },
  handler: async (ctx, { table }) => {
    const rows = await ctx.db.query(table as "issues").take(4000);
    for (const row of rows) await ctx.db.delete(row._id);
    return rows.length;
  },
});

/** Row counts for the write-up. */
export const counts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const out: Record<string, number> = {};
    for (const table of ["issues", "comments", "activity", "projects", "labels"] as const) {
      out[table] = (await ctx.db.query(table).take(20000)).length;
    }
    return out;
  },
});
