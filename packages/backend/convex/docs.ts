import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { fail, notFound } from "./lib/errors";

const MAX_BODY = 100_000;

/** The space's context doc (agents read it first over MCP). */
export const getContext = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, { spaceId }) => {
    const me = await requireMember(ctx);
    const space = await ctx.db.get("spaces", spaceId);
    if (!space || space.workspaceId !== me.workspaceId) return notFound("Space");
    const doc = await ctx.db
      .query("docs")
      .withIndex("by_space_and_kind", (q) => q.eq("spaceId", spaceId).eq("kind", "space_context"))
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
  args: { spaceId: v.id("spaces"), body: v.string() },
  handler: async (ctx, { spaceId, body }) => {
    const me = await requireMember(ctx);
    const space = await ctx.db.get("spaces", spaceId);
    if (!space || space.workspaceId !== me.workspaceId) return notFound("Space");
    if (body.length > MAX_BODY) fail("TOO_LONG", `The context doc can be at most ${MAX_BODY.toLocaleString("en")} characters.`);
    const doc = await ctx.db
      .query("docs")
      .withIndex("by_space_and_kind", (q) => q.eq("spaceId", spaceId).eq("kind", "space_context"))
      .first();
    const now = Date.now();
    if (doc) {
      if (doc.body === body) return;
      await ctx.db.patch("docs", doc._id, { body, updatedBy: me._id, updatedAt: now });
    } else {
      await ctx.db.insert("docs", {
        workspaceId: me.workspaceId,
        spaceId,
        kind: "space_context",
        title: `${space.name} context`,
        body,
        updatedBy: me._id,
        updatedAt: now,
      });
    }
  },
});
