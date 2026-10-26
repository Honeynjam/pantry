import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

/**
 * The signed-in Better Auth user id, or null. The one place that knows how a
 * Convex identity maps to a Better Auth user (the JWT subject is the user id),
 * so tests can use `t.withIdentity({ subject })` without the auth component.
 */
export async function getAuthUserId(ctx: AnyCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

/** The signed-in Better Auth user id; throws when signed out. */
export async function requireAuthUserId(ctx: AnyCtx): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in first." });
  }
  return userId;
}

/**
 * The caller's `members` row. Every public app function calls this first.
 * Throws when signed out or when the user isn't a member of this instance's workspace.
 */
export async function requireMember(ctx: QueryCtx | MutationCtx): Promise<Doc<"members">> {
  const userId = await requireAuthUserId(ctx);
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (!member) {
    throw new ConvexError({ code: "NOT_A_MEMBER", message: "You're not a member of this workspace." });
  }
  return member;
}
