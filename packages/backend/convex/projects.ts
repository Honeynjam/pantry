import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { fail } from "./lib/errors";
import { setIssueProject } from "./lib/issues";
import { activeProjects, getProject, getSpace, nameKey } from "./lib/spaces";
import { checkColor, cleanName } from "./lib/validate";

/**
 * Projects: optional workstreams inside a space ("LinkedIn", "Marketing", "Launch"). A name, an
 * optional colour, an order and an archive flag; an issue is in at most one. Names are unique per
 * space among active projects, ignoring case (MCP looks them up by name).
 */

async function checkNameFree(ctx: MutationCtx, spaceId: Id<"spaces">, name: string, except?: Id<"projects">) {
  const taken = (await activeProjects(ctx, spaceId)).find(
    (project) => project._id !== except && nameKey(project.name) === nameKey(name),
  );
  if (taken) fail("NAME_TAKEN", `There's already a project called ${taken.name} in this space.`);
}

export const create = mutation({
  args: { spaceId: v.id("spaces"), name: v.string(), color: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    const space = await getSpace(ctx, me.workspaceId, args.spaceId);
    if (space.archivedAt !== undefined) fail("ARCHIVED", `${space.name} is archived.`);
    const name = cleanName(args.name, "Project name", 60);
    await checkNameFree(ctx, space._id, name);
    const last = (await activeProjects(ctx, space._id)).at(-1);
    return ctx.db.insert("projects", {
      workspaceId: me.workspaceId,
      spaceId: space._id,
      name,
      ...(args.color !== undefined ? { color: checkColor(args.color) } : {}),
      sortOrder: (last?.sortOrder ?? 0) + 1,
    });
  },
});

/** Rename and recolour (`color: null` removes the colour). */
export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    color: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    const project = await getProject(ctx, me.workspaceId, args.projectId);
    const patch: Partial<Doc<"projects">> = {};
    if (args.name !== undefined) {
      const name = cleanName(args.name, "Project name", 60);
      if (project.archivedAt === undefined) await checkNameFree(ctx, project.spaceId, name, project._id);
      patch.name = name;
    }
    if (args.color !== undefined) patch.color = args.color === null ? undefined : checkColor(args.color);
    await ctx.db.patch("projects", project._id, patch);
  },
});

/**
 * Archive: the project leaves the sidebar and pickers, and every issue in it stays in the space with
 * no project (each an issue write: `updatedAt` and one `project_changed` row).
 */
export const archive = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    const project = await getProject(ctx, me.workspaceId, args.projectId);
    if (project.archivedAt !== undefined) return;
    const issues = await ctx.db
      .query("issues")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    const now = Date.now();
    for (const issue of issues) {
      // Sub-issues are cleared along with their parent; re-read so none is written twice.
      const current = await ctx.db.get("issues", issue._id);
      if (current?.projectId === project._id) await setIssueProject(ctx, { member: me, via: "app" }, current, null, now);
    }
    await ctx.db.patch("projects", project._id, { archivedAt: now });
  },
});

/** New order for a space's active projects: every one of them, each once. */
export const reorder = mutation({
  args: { spaceId: v.id("spaces"), projectIds: v.array(v.id("projects")) },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    const space = await getSpace(ctx, me.workspaceId, args.spaceId);
    const current = await activeProjects(ctx, space._id);
    const ids = new Set(current.map((project) => project._id));
    const same =
      args.projectIds.length === current.length &&
      new Set(args.projectIds).size === args.projectIds.length &&
      args.projectIds.every((id) => ids.has(id));
    if (!same) fail("INVALID_ORDER", "The new order has to list each of the space's projects once.");
    for (const [index, projectId] of args.projectIds.entries()) {
      await ctx.db.patch("projects", projectId, { sortOrder: index + 1 });
    }
  },
});
