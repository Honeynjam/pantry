import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { Actor } from "./lib/activity";
import { requireMember } from "./lib/auth";
import { notFound } from "./lib/errors";
import { changeStatus, createIssue, deleteIssue, getIssue, getStatus, isTerminal, updateIssue } from "./lib/issues";
import { priority } from "./schema";

/** Done and canceled issues older than this are hidden from lists and boards unless asked for. */
export const RECENT_DONE_MS = 14 * 24 * 60 * 60 * 1000;

const app = (member: Doc<"members">): Actor => ({ member, via: "app" });

/** Issues of one project, ordered by status (workspace order) then `sortOrder`. */
export const listByProject = query({
  args: { projectId: v.id("projects"), includeDone: v.optional(v.boolean()) },
  handler: async (ctx, { projectId, includeDone }) => {
    const me = await requireMember(ctx);
    const project = await ctx.db.get("projects", projectId);
    if (!project || project.workspaceId !== me.workspaceId) return notFound("Project");
    const statuses = await ctx.db
      .query("statuses")
      .withIndex("by_workspace_and_order", (q) => q.eq("workspaceId", me.workspaceId))
      .collect();
    const since = Date.now() - RECENT_DONE_MS;
    const columns = await Promise.all(
      statuses.map(async (status) => {
        const issues = await ctx.db
          .query("issues")
          .withIndex("by_project_and_status", (q) => q.eq("projectId", projectId).eq("statusId", status._id))
          .collect();
        if (includeDone || !isTerminal(status.category)) return issues;
        return issues.filter((issue) => (issue.completedAt ?? issue.updatedAt) >= since);
      }),
    );
    return columns.flat();
  },
});

/** My open issues (unstarted, started, review), most recently updated first. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireMember(ctx);
    const groups = await Promise.all(
      (["unstarted", "started", "review"] as const).map((category) =>
        ctx.db
          .query("issues")
          .withIndex("by_assignee_and_category", (q) => q.eq("assigneeId", me._id).eq("statusCategory", category))
          .collect(),
      ),
    );
    return groups.flat().sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/** One issue by key (`PAN-42`, any case) with sub-issues, comments and the last 100 activity rows. */
export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    const key = args.key.trim().toUpperCase();
    const issue = await ctx.db
      .query("issues")
      .withIndex("by_workspace_and_key", (q) => q.eq("workspaceId", me.workspaceId).eq("key", key))
      .first();
    if (!issue) return null;
    const [subIssues, comments, activity, parent, project] = await Promise.all([
      ctx.db
        .query("issues")
        .withIndex("by_parent", (q) => q.eq("parentId", issue._id))
        .collect(),
      ctx.db
        .query("comments")
        .withIndex("by_issue", (q) => q.eq("issueId", issue._id))
        .collect(),
      ctx.db
        .query("activity")
        .withIndex("by_issue", (q) => q.eq("issueId", issue._id))
        .order("desc")
        .take(100),
      issue.parentId ? ctx.db.get("issues", issue.parentId) : null,
      ctx.db.get("projects", issue.projectId),
    ]);
    return {
      issue,
      project,
      parent: parent ? { _id: parent._id, key: parent.key, title: parent.title, statusId: parent.statusId } : null,
      subIssues: subIssues.sort((a, b) => a.number - b.number),
      comments,
      activity: activity.reverse(),
    };
  },
});

const SEARCH_LIMIT = 20;
const KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}-\d+$/;

/** What the palette shows for a match: no description, so results stay small. */
const searchResult = (issue: Doc<"issues">) => ({
  _id: issue._id,
  key: issue.key,
  title: issue.title,
  projectId: issue.projectId,
  statusId: issue.statusId,
  priority: issue.priority,
  assigneeId: issue.assigneeId,
});

/**
 * Up to 20 issues for the command palette: an exact key match first (`PAN-42`, any case), then a
 * bare number as a key in every project (`42` → PAN-42, WEB-42), then title matches from the
 * `search_title` index (relevance order; the last word matches as a prefix while you type).
 */
export const search = query({
  args: { text: v.string(), projectId: v.optional(v.id("projects")) },
  handler: async (ctx, { text, projectId }) => {
    const me = await requireMember(ctx);
    const trimmed = text.trim();
    if (!trimmed) return [];
    const found = new Map<string, Doc<"issues">>();
    const byKey = async (key: string) => {
      const issue = await ctx.db
        .query("issues")
        .withIndex("by_workspace_and_key", (q) => q.eq("workspaceId", me.workspaceId).eq("key", key))
        .first();
      if (issue && (!projectId || issue.projectId === projectId)) found.set(issue._id, issue);
    };

    const upper = trimmed.toUpperCase();
    if (KEY_PATTERN.test(upper)) await byKey(upper);
    if (/^\d{1,9}$/.test(trimmed)) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", me.workspaceId))
        .collect();
      for (const project of projects) await byKey(`${project.key}-${Number(trimmed)}`);
    }

    const matches = await ctx.db
      .query("issues")
      .withSearchIndex("search_title", (q) => {
        const scoped = q.search("title", trimmed).eq("workspaceId", me.workspaceId);
        return projectId ? scoped.eq("projectId", projectId) : scoped;
      })
      .take(SEARCH_LIMIT);
    for (const issue of matches) if (!found.has(issue._id)) found.set(issue._id, issue);
    return [...found.values()].slice(0, SEARCH_LIMIT).map(searchResult);
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    statusId: v.optional(v.id("statuses")),
    priority: v.optional(priority),
    assigneeId: v.optional(v.id("members")),
    labelIds: v.optional(v.array(v.id("labels"))),
    parentId: v.optional(v.id("issues")),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    return createIssue(ctx, app(me), args);
  },
});

/** Field changes; one activity row per changed field. Never changes status (that's `move`). */
export const update = mutation({
  args: {
    issueId: v.id("issues"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(priority),
    assigneeId: v.optional(v.union(v.id("members"), v.null())),
    labelIds: v.optional(v.array(v.id("labels"))),
    dueDate: v.optional(v.union(v.string(), v.null())),
    parentId: v.optional(v.union(v.id("issues"), v.null())),
  },
  handler: async (ctx, { issueId, ...changes }) => {
    const me = await requireMember(ctx);
    const issue = await getIssue(ctx, me.workspaceId, issueId);
    await updateIssue(ctx, app(me), issue, changes);
  },
});

/**
 * Status change and drag in one: the board, the list and the status picker all call this.
 * `afterId` is the issue it lands right after, `beforeId` the one it lands right before.
 */
export const move = mutation({
  args: {
    issueId: v.id("issues"),
    statusId: v.id("statuses"),
    beforeId: v.optional(v.id("issues")),
    afterId: v.optional(v.id("issues")),
  },
  handler: async (ctx, { issueId, statusId, beforeId, afterId }) => {
    const me = await requireMember(ctx);
    const issue = await getIssue(ctx, me.workspaceId, issueId);
    const status = await getStatus(ctx, me.workspaceId, statusId);
    await changeStatus(ctx, app(me), issue, status, { beforeId, afterId });
  },
});

/** Hard delete with comments, activity and sub-issues (the app asks for confirmation first). */
export const remove = mutation({
  args: { issueId: v.id("issues") },
  handler: async (ctx, { issueId }) => {
    const me = await requireMember(ctx);
    const issue = await getIssue(ctx, me.workspaceId, issueId);
    await deleteIssue(ctx, issue);
  },
});
