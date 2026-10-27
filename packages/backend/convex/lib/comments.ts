import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { logActivity, type Actor } from "./activity";
import { fail } from "./errors";

export const MAX_COMMENT = 20_000;

export function cleanBody(body: string): string {
  if (!body.trim()) fail("EMPTY", "Write something first.");
  if (body.length > MAX_COMMENT)
    fail("TOO_LONG", `Comments can be at most ${MAX_COMMENT.toLocaleString("en")} characters.`);
  return body;
}

/**
 * A new comment, shared by `comments.add` (via "app") and MCP `add_comment` (via "mcp"). Adding a
 * comment is an issue write: `updatedAt` moves and a `commented` activity row is added.
 */
export async function addComment(
  ctx: MutationCtx,
  actor: Actor,
  issue: Doc<"issues">,
  body: string,
) {
  const commentId = await ctx.db.insert("comments", {
    issueId: issue._id,
    authorId: actor.member._id,
    body: cleanBody(body),
    via: actor.via,
  });
  await ctx.db.patch("issues", issue._id, { updatedAt: Date.now() });
  await logActivity(ctx, actor, issue, "commented");
  return commentId;
}
