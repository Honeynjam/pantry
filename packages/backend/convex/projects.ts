import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { SAMPLE_CONTEXT_DOC } from "./lib/defaults";
import { fail, notFound } from "./lib/errors";
import { cleanName, PROJECT_KEY_PATTERN } from "./lib/validate";

/** A project in the caller's workspace, archived or not; "not found" for anything else. */
export async function getProjectInWorkspace(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const project = await ctx.db.get("projects", projectId);
  if (!project || project.workspaceId !== workspaceId) return notFound("Project");
  return project;
}

/**
 * New project with its context doc. The key is unique per workspace, archived projects included
 * (their issues keep their keys), and fixed after creation.
 */
export const create = mutation({
  args: { name: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    const name = cleanName(args.name, "Project name");
    const key = args.key.trim().toUpperCase();
    if (!PROJECT_KEY_PATTERN.test(key)) {
      fail("INVALID_KEY", "Keys are 2–10 letters or digits and start with a letter, like PAN or WEB2.");
    }
    const taken = await ctx.db
      .query("projects")
      .withIndex("by_workspace_and_key", (q) => q.eq("workspaceId", me.workspaceId).eq("key", key))
      .first();
    if (taken) {
      fail(
        "KEY_TAKEN",
        taken.archivedAt === undefined
          ? `${key} is already the key of ${taken.name}.`
          : `${key} belongs to an archived project (${taken.name}). Pick another key.`,
      );
    }

    const projectId = await ctx.db.insert("projects", {
      workspaceId: me.workspaceId,
      name,
      key,
      nextIssueNumber: 1,
    });
    await ctx.db.insert("docs", {
      workspaceId: me.workspaceId,
      projectId,
      kind: "project_context",
      title: `${name} context`,
      body: SAMPLE_CONTEXT_DOC,
      updatedBy: me._id,
      updatedAt: Date.now(),
    });
    return { projectId, key };
  },
});

/** Rename. The key can't change (issue keys and agents' references depend on it). */
export const update = mutation({
  args: { projectId: v.id("projects"), name: v.string() },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    await getProjectInWorkspace(ctx, me.workspaceId, args.projectId);
    await ctx.db.patch("projects", args.projectId, { name: cleanName(args.name, "Project name") });
  },
});

/** Hides the project from the sidebar and lists; its issues and key stay. */
export const archive = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    const project = await getProjectInWorkspace(ctx, me.workspaceId, args.projectId);
    if (project.archivedAt === undefined) await ctx.db.patch("projects", project._id, { archivedAt: Date.now() });
  },
});
