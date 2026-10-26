import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { fail, notFound } from "./lib/errors";

const MAX_BODY = 100_000;

/** The project's context doc (agents read it first over MCP). */
export const getContext = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const me = await requireMember(ctx);
    const project = await ctx.db.get("projects", projectId);
    if (!project || project.workspaceId !== me.workspaceId) return notFound("Project");
    const doc = await ctx.db
      .query("docs")
      .withIndex("by_project_and_kind", (q) => q.eq("projectId", projectId).eq("kind", "project_context"))
      .first();
    if (!doc) return null;
    const editor = await ctx.db.get("members", doc.updatedBy);
    return {
      _id: doc._id,
      title: doc.title,
      body: doc.body,
      updatedAt: doc.updatedAt,
      updatedBy: editor ? { _id: editor._id, displayName: editor.displayName } : null,
    };
  },
});

/** Saves the markdown body (the editor saves on blur and Cmd/Ctrl+Enter, never per keystroke). */
export const saveContext = mutation({
  args: { projectId: v.id("projects"), body: v.string() },
  handler: async (ctx, { projectId, body }) => {
    const me = await requireMember(ctx);
    const project = await ctx.db.get("projects", projectId);
    if (!project || project.workspaceId !== me.workspaceId) return notFound("Project");
    if (body.length > MAX_BODY) fail("TOO_LONG", `The context doc can be at most ${MAX_BODY.toLocaleString("en")} characters.`);
    const doc = await ctx.db
      .query("docs")
      .withIndex("by_project_and_kind", (q) => q.eq("projectId", projectId).eq("kind", "project_context"))
      .first();
    const now = Date.now();
    if (doc) {
      if (doc.body === body) return;
      await ctx.db.patch("docs", doc._id, { body, updatedBy: me._id, updatedAt: now });
    } else {
      await ctx.db.insert("docs", {
        workspaceId: me.workspaceId,
        projectId,
        kind: "project_context",
        title: `${project.name} context`,
        body,
        updatedBy: me._id,
        updatedAt: now,
      });
    }
  },
});
