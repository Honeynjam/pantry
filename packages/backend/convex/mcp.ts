import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Actor } from "./lib/activity";
import { findToken, requireToken } from "./lib/auth";
import { addComment as insertComment } from "./lib/comments";
import { fail } from "./lib/errors";
import { changeStatus, createIssue as insertIssue, updateIssue as applyUpdate } from "./lib/issues";
import { isProject, issueSpaceId } from "./lib/model";
import {
  resolveAssignee,
  resolveLabelsByName,
  resolveStatusByName,
  workspaceLabels,
  workspaceMembers,
  workspaceStatuses,
} from "./lib/names";
import { priorityName } from "./lib/priority";
import { activeProjects, getSpace, resolveProjectByName, resolveSpaceByKey } from "./lib/spaces";
import { shouldTouch } from "./lib/tokens";
import { category, priority } from "./schema";

/**
 * The MCP surface (spec §6, §10b "MCP tools"): one public function per tool, called by
 * `packages/mcp` over ConvexHttpClient with the caller's plain API token. Every function calls
 * `requireToken` first and resolves spaces, projects, issues, statuses, labels and members inside the
 * token's workspace only ("not found" otherwise). Writes go through the same helpers as the app,
 * with `via: "mcp"`, so the app shows them under the token's owner, tagged "via MCP".
 *
 * Results are plain JSON for agents: names instead of ids, ISO times. The adapter adds URLs.
 */

const asMcp = (member: Doc<"members">): Actor => ({ member, via: "mcp" });
const iso = (time: number) => new Date(time).toISOString();

export const LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;
const MAX_COMMENTS = 50;

// ---------------------------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------------------------

/**
 * Who a token acts as, or null when it's unknown or revoked (the route answers 401). Returns
 * `lastUsedAt` so the route can call `touchToken` only when it's stale.
 */
export const verifyToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const owner = await findToken(ctx, token);
    if (!owner) return null;
    const { apiToken, member } = owner;
    return {
      tokenId: apiToken._id,
      memberId: member._id,
      workspaceId: member.workspaceId,
      userId: member.userId,
      displayName: member.displayName,
      lastUsedAt: apiToken.lastUsedAt ?? null,
    };
  },
});

/** Records use of a token, at most once per 10 minutes (spec §10b). Returns whether it wrote. */
export const touchToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const owner = await findToken(ctx, token);
    if (!owner) return false;
    const now = Date.now();
    if (!shouldTouch(owner.apiToken.lastUsedAt, now)) return false;
    await ctx.db.patch("apiTokens", owner.apiToken._id, { lastUsedAt: now });
    return true;
  },
});

// ---------------------------------------------------------------------------------------------
// Reading issues as agents see them
// ---------------------------------------------------------------------------------------------

async function issueByKey(ctx: QueryCtx, workspaceId: Id<"workspaces">, key: string): Promise<Doc<"issues">> {
  const upper = key.trim().toUpperCase();
  const issue = await ctx.db
    .query("issues")
    .withIndex("by_workspace_and_key", (q) => q.eq("workspaceId", workspaceId).eq("key", upper))
    .first();
  if (!issue) return fail("NOT_FOUND", `No issue ${upper} in this workspace.`);
  return issue;
}

/** Names for ids, loaded once per call: statuses, labels, members and spaces are small tables. */
async function namer(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const [statuses, labels, members, spaces] = await Promise.all([
    workspaceStatuses(ctx, workspaceId),
    workspaceLabels(ctx, workspaceId),
    workspaceMembers(ctx, workspaceId),
    ctx.db
      .query("spaces")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect(),
  ]);
  const byId = <T extends { _id: string }>(rows: T[]) => new Map(rows.map((row) => [row._id, row]));
  const statusMap = byId(statuses);
  const labelMap = byId(labels);
  const memberMap = byId(members);
  const spaceMap = byId(spaces);
  const projectNames = new Map<Id<"projects">, string | null>();
  const parentKeys = new Map<Id<"issues">, string | null>();

  async function projectName(issue: Doc<"issues">) {
    // On an unmigrated M2 issue, projectId still means its M2 project (now a space), not a workstream.
    if (!issue.projectId || !issue.spaceId) return null;
    if (!projectNames.has(issue.projectId)) {
      const project = await ctx.db.get("projects", issue.projectId);
      projectNames.set(issue.projectId, project && isProject(project) ? project.name : null);
    }
    return projectNames.get(issue.projectId) ?? null;
  }

  async function parentKey(issue: Doc<"issues">) {
    if (!issue.parentId) return null;
    if (!parentKeys.has(issue.parentId)) {
      const parent = await ctx.db.get("issues", issue.parentId);
      parentKeys.set(issue.parentId, parent?.key ?? null);
    }
    return parentKeys.get(issue.parentId) ?? null;
  }

  const member = (id: Id<"members"> | undefined) => (id ? (memberMap.get(id)?.displayName ?? null) : null);

  /** One issue as a list row. */
  async function row(issue: Doc<"issues">) {
    const status = statusMap.get(issue.statusId);
    return {
      key: issue.key,
      title: issue.title,
      space: issue.spaceId ? (spaceMap.get(issue.spaceId)?.key ?? null) : null,
      project: await projectName(issue),
      status: status?.name ?? null,
      category: issue.statusCategory,
      priority: priorityName(issue.priority),
      assignee: member(issue.assigneeId),
      labels: issue.labelIds.flatMap((id) => labelMap.get(id)?.name ?? []),
      parent: await parentKey(issue),
      dueDate: issue.dueDate ?? null,
      updatedAt: iso(issue.updatedAt),
    };
  }

  return { row, member, status: (id: Id<"statuses">) => statusMap.get(id)?.name ?? null };
}

// ---------------------------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------------------------

/** `get_issue`: the issue, its sub-issues and its last 50 comments. */
export const getIssue = query({
  args: { token: v.string(), key: v.string() },
  handler: async (ctx, { token, key }) => {
    const { member: me } = await requireToken(ctx, token);
    const issue = await issueByKey(ctx, me.workspaceId, key);
    const names = await namer(ctx, me.workspaceId);
    const [subIssues, comments] = await Promise.all([
      ctx.db
        .query("issues")
        .withIndex("by_parent", (q) => q.eq("parentId", issue._id))
        .collect(),
      ctx.db
        .query("comments")
        .withIndex("by_issue", (q) => q.eq("issueId", issue._id))
        .order("desc")
        .take(MAX_COMMENTS),
    ]);
    return {
      ...(await names.row(issue)),
      description: issue.description,
      creator: names.member(issue.creatorId),
      createdAt: iso(issue._creationTime),
      completedAt: issue.completedAt !== undefined ? iso(issue.completedAt) : null,
      subIssues: subIssues
        .sort((a, b) => a.number - b.number)
        .map((sub) => ({ key: sub.key, title: sub.title, status: names.status(sub.statusId), category: sub.statusCategory })),
      comments: comments.reverse().map((comment) => ({
        id: comment._id,
        author: names.member(comment.authorId),
        body: comment.body,
        via: comment.via,
        createdAt: iso(comment._creationTime),
        ...(comment.editedAt !== undefined ? { editedAt: iso(comment.editedAt) } : {}),
      })),
    };
  },
});

/** `get_space_context`: the space, its projects and its context doc (agents read it first). */
export const getSpaceContext = query({
  args: { token: v.string(), space: v.string() },
  handler: async (ctx, args) => {
    const { member: me } = await requireToken(ctx, args.token);
    const space = await resolveSpaceByKey(ctx, me.workspaceId, args.space);
    const [projects, doc] = await Promise.all([
      activeProjects(ctx, space._id),
      ctx.db
        .query("docs")
        .withIndex("by_space_and_kind", (q) => q.eq("spaceId", space._id).eq("kind", "space_context"))
        .first(),
    ]);
    const editor = doc ? await ctx.db.get("members", doc.updatedBy) : null;
    return {
      space: { key: space.key, name: space.name, kind: space.kind ?? "product" },
      projects: projects.map((project) => project.name),
      context: doc?.body ?? "",
      updatedAt: doc ? iso(doc.updatedAt) : null,
      updatedBy: editor?.displayName ?? null,
    };
  },
});

/** `list_issues`: newest first, filtered by space, project, status, category, assignee, label, priority. */
export const listIssues = query({
  args: {
    token: v.string(),
    space: v.optional(v.string()),
    project: v.optional(v.string()),
    status: v.optional(v.string()),
    category: v.optional(category),
    assignee: v.optional(v.string()),
    label: v.optional(v.string()),
    priority: v.optional(priority),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { member: me } = await requireToken(ctx, args.token);
    const workspaceId = me.workspaceId;
    if (args.project !== undefined && args.space === undefined) {
      fail("INVALID_INPUT", "Projects are found by name inside one space: give `space` too.");
    }
    const space = args.space !== undefined ? await resolveSpaceByKey(ctx, workspaceId, args.space) : null;
    const project = space && args.project !== undefined ? await resolveProjectByName(ctx, space, args.project) : undefined;
    const status = args.status !== undefined ? await resolveStatusByName(ctx, workspaceId, args.status) : null;
    const assignee = args.assignee !== undefined ? await resolveAssignee(ctx, me, args.assignee) : undefined;
    const label = args.label !== undefined ? (await resolveLabelsByName(ctx, workspaceId, [args.label]))[0]! : null;
    const limit = Math.max(1, Math.min(MAX_LIST_LIMIT, Math.floor(args.limit ?? LIST_LIMIT)));

    // Walk the narrowest newest-first index the filters allow, then filter in code and stop at
    // `limit`: a space's issues, else an assignee's, else the workspace's.
    const matches: Doc<"issues">[] = [];
    const newestFirst = space
      ? ctx.db
          .query("issues")
          .withIndex("by_space_and_updated", (q) => q.eq("spaceId", space._id))
          .order("desc")
      : assignee
        ? ctx.db
            .query("issues")
            .withIndex("by_assignee_and_updated", (q) => q.eq("assigneeId", assignee._id))
            .order("desc")
        : ctx.db
            .query("issues")
            .withIndex("by_workspace_and_updated", (q) => q.eq("workspaceId", workspaceId))
            .order("desc");
    for await (const issue of newestFirst) {
      if (issue.workspaceId !== workspaceId) continue;
      if (space && issue.spaceId !== space._id) continue;
      if (project !== undefined && issue.projectId !== (project?._id ?? undefined)) continue;
      if (status && issue.statusId !== status._id) continue;
      if (args.category && issue.statusCategory !== args.category) continue;
      if (assignee !== undefined && issue.assigneeId !== (assignee?._id ?? undefined)) continue;
      if (label && !issue.labelIds.includes(label._id)) continue;
      if (args.priority !== undefined && issue.priority !== args.priority) continue;
      matches.push(issue);
      if (matches.length >= limit) break;
    }
    const names = await namer(ctx, workspaceId);
    return Promise.all(matches.map((issue) => names.row(issue)));
  },
});

/** `create_issue`: a new issue in a space, optionally in one of its projects. */
export const createIssue = mutation({
  args: {
    token: v.string(),
    space: v.string(),
    project: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(priority),
    assignee: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { member: me } = await requireToken(ctx, args.token);
    const workspaceId = me.workspaceId;
    const space = await resolveSpaceByKey(ctx, workspaceId, args.space);
    const project = args.project !== undefined ? await resolveProjectByName(ctx, space, args.project) : null;
    const status = args.status !== undefined ? await resolveStatusByName(ctx, workspaceId, args.status) : null;
    const assignee = args.assignee !== undefined ? await resolveAssignee(ctx, me, args.assignee) : null;
    const labels = await resolveLabelsByName(ctx, workspaceId, args.labels ?? []);
    const { key } = await insertIssue(ctx, asMcp(me), {
      spaceId: space._id,
      projectId: project?._id ?? null,
      title: args.title,
      ...(args.description !== undefined ? { description: args.description } : {}),
      ...(status ? { statusId: status._id } : {}),
      ...(args.priority !== undefined ? { priority: args.priority } : {}),
      ...(assignee ? { assigneeId: assignee._id } : {}),
      labelIds: labels.map((label) => label._id),
      ...(args.dueDate !== undefined ? { dueDate: args.dueDate } : {}),
    });
    return { key, space: space.key, project: project?.name ?? null };
  },
});

/** `create_sub_issue`: a sub-issue under `parent`, in the parent's space and project. */
export const createSubIssue = mutation({
  args: {
    token: v.string(),
    parent: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(priority),
    assignee: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { member: me } = await requireToken(ctx, args.token);
    const parent = await issueByKey(ctx, me.workspaceId, args.parent);
    const assignee = args.assignee !== undefined ? await resolveAssignee(ctx, me, args.assignee) : null;
    // The shared rule takes space and project from the parent and refuses a parent that is a sub-issue.
    const { issueId, key } = await insertIssue(ctx, asMcp(me), {
      parentId: parent._id,
      title: args.title,
      ...(args.description !== undefined ? { description: args.description } : {}),
      ...(args.priority !== undefined ? { priority: args.priority } : {}),
      ...(assignee ? { assigneeId: assignee._id } : {}),
    });
    const created = (await ctx.db.get("issues", issueId))!;
    const names = await namer(ctx, me.workspaceId);
    const row = await names.row(created);
    return { key, parent: parent.key, space: row.space, project: row.project };
  },
});

/** `add_comment`: a markdown comment, shown under the token's owner, tagged "via MCP". */
export const addComment = mutation({
  args: { token: v.string(), key: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    const { member: me } = await requireToken(ctx, args.token);
    const issue = await issueByKey(ctx, me.workspaceId, args.key);
    const commentId = await insertComment(ctx, asMcp(me), issue, args.body);
    return { key: issue.key, commentId };
  },
});

/**
 * `update_issue`: status (through the one status helper), priority, assignee, labels and project
 * (through the same update helper as the app). Everything is resolved before anything is written,
 * and the mutation is one transaction, so a bad name changes nothing.
 */
export const updateIssue = mutation({
  args: {
    token: v.string(),
    key: v.string(),
    status: v.optional(v.string()),
    priority: v.optional(priority),
    assignee: v.optional(v.string()),
    addLabels: v.optional(v.array(v.string())),
    removeLabels: v.optional(v.array(v.string())),
    project: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { member: me } = await requireToken(ctx, args.token);
    const workspaceId = me.workspaceId;
    const issue = await issueByKey(ctx, workspaceId, args.key);
    const { status: statusName, priority: nextPriority, assignee: assigneeName, addLabels, removeLabels, project: projectName } = args;
    if (
      [statusName, nextPriority, assigneeName, addLabels, removeLabels, projectName].every((value) => value === undefined)
    ) {
      fail("INVALID_INPUT", "Nothing to change: give at least one of status, priority, assignee, addLabels, removeLabels or project.");
    }

    const status = statusName !== undefined ? await resolveStatusByName(ctx, workspaceId, statusName) : null;
    const assignee = assigneeName !== undefined ? await resolveAssignee(ctx, me, assigneeName) : undefined;
    let labelIds: Id<"labels">[] | undefined;
    if (addLabels !== undefined || removeLabels !== undefined) {
      const add = await resolveLabelsByName(ctx, workspaceId, addLabels ?? []);
      const remove = new Set((await resolveLabelsByName(ctx, workspaceId, removeLabels ?? [])).map((label) => label._id));
      labelIds = [...new Set([...issue.labelIds, ...add.map((label) => label._id)])].filter((id) => !remove.has(id));
    }
    let projectId: Id<"projects"> | null | undefined;
    if (projectName !== undefined) {
      const space = await getSpace(ctx, workspaceId, issueSpaceId(issue));
      projectId = (await resolveProjectByName(ctx, space, projectName))?._id ?? null;
    }

    const actor = asMcp(me);
    await applyUpdate(ctx, actor, issue, {
      ...(nextPriority !== undefined ? { priority: nextPriority } : {}),
      ...(assignee !== undefined ? { assigneeId: assignee?._id ?? null } : {}),
      ...(labelIds !== undefined ? { labelIds } : {}),
      ...(projectId !== undefined ? { projectId } : {}),
    });
    if (status) await changeStatus(ctx, actor, (await ctx.db.get("issues", issue._id))!, status);

    const names = await namer(ctx, workspaceId);
    return names.row((await ctx.db.get("issues", issue._id))!);
  },
});
