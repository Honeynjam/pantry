import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { addComment, cleanBody } from "./lib/comments";
import { fail, notFound } from "./lib/errors";
import { getIssue } from "./lib/issues";

/** A comment the caller wrote, in their workspace. Only authors edit or remove their comments. */
async function ownComment(ctx: MutationCtx, me: Doc<"members">, commentId: Id<"comments">) {
  const comment = await ctx.db.get("comments", commentId);
  if (!comment) return notFound("Comment");
  await getIssue(ctx, me.workspaceId, comment.issueId);
  if (comment.authorId !== me._id) fail("NOT_AUTHOR", "Only the author can change this comment.");
  return comment;
}

/** Adding a comment is an issue write: `updatedAt` moves and a `commented` activity row is added. */
export const add = mutation({
  args: { issueId: v.id("issues"), body: v.string() },
  handler: async (ctx, { issueId, body }) => {
    const me = await requireMember(ctx);
    const issue = await getIssue(ctx, me.workspaceId, issueId);
    return addComment(ctx, { member: me, via: "app" }, issue, body);
  },
});

export const edit = mutation({
  args: { commentId: v.id("comments"), body: v.string() },
  handler: async (ctx, { commentId, body }) => {
    const me = await requireMember(ctx);
    const comment = await ownComment(ctx, me, commentId);
    const clean = cleanBody(body);
    if (clean !== comment.body)
      await ctx.db.patch("comments", comment._id, { body: clean, editedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, { commentId }) => {
    const me = await requireMember(ctx);
    const comment = await ownComment(ctx, me, commentId);
    await ctx.db.delete("comments", comment._id);
  },
});
