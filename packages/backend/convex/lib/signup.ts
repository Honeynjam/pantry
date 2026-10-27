import type { QueryCtx } from "../_generated/server";

export type SignUpCheck =
  { allowed: true; reason: "setup" | "invite" } | { allowed: false; reason: "invite_required" };

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Invite-only sign-up: allowed while the instance has no members yet (first-run setup),
 * otherwise only with a pending (not accepted, not revoked), unexpired invite for that email.
 */
export async function checkSignUp(
  ctx: Pick<QueryCtx, "db">,
  email: string,
  now: number,
): Promise<SignUpCheck> {
  const anyMember = await ctx.db.query("members").first();
  if (!anyMember) return { allowed: true, reason: "setup" };

  const invites = await ctx.db
    .query("invites")
    .withIndex("by_email", (q) => q.eq("email", normalizeEmail(email)))
    .collect();
  const pending = invites.some(
    (invite) =>
      invite.acceptedAt === undefined && invite.revokedAt === undefined && invite.expiresAt > now,
  );
  return pending
    ? { allowed: true, reason: "invite" }
    : { allowed: false, reason: "invite_required" };
}
