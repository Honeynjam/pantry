import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, env, internalMutation, mutation, query } from "./_generated/server";
import { getAuthEmail, requireAuthUserId, requireOwner } from "./lib/auth";
import { normalizeEmail } from "./lib/signup";
import { INVITE_TOKEN_PREFIX, randomToken, sha256Hex } from "./lib/tokens";

/** Invite links expire after 7 days (spec §12 default). */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteState = "pending" | "accepted" | "revoked" | "expired";

export function inviteState(invite: Doc<"invites">, now: number): InviteState {
  if (invite.acceptedAt !== undefined) return "accepted";
  if (invite.revokedAt !== undefined) return "revoked";
  if (invite.expiresAt <= now) return "expired";
  return "pending";
}

/** The path the sign-up page reads (`?invite=`). The host prepends its own origin when SITE_URL is unset. */
export const invitePath = (token: string) => `/sign-up?invite=${encodeURIComponent(token)}`;

/**
 * Owner only. Generates the token here (randomness belongs in actions), stores only its hash and
 * returns the link once. v0.1 sends no email: the owner copies the link and sends it themselves.
 */
export const create = action({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<{ inviteId: Id<"invites">; token: string; url: string | null; expiresAt: number }> => {
    const token = randomToken(INVITE_TOKEN_PREFIX);
    const tokenHash = await sha256Hex(token);
    const { inviteId, expiresAt } = await ctx.runMutation(internal.invites.insert, { email, tokenHash });
    const siteUrl = env.SITE_URL?.replace(/\/+$/, "");
    return { inviteId, token, url: siteUrl ? `${siteUrl}${invitePath(token)}` : null, expiresAt };
  },
});

/** Internal half of `create`: the owner check and the write. Auth carries over from the action. */
export const insert = internalMutation({
  args: { email: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    const me = await requireOwner(ctx);
    const email = normalizeEmail(args.email);
    if (!EMAIL_PATTERN.test(email)) {
      throw new ConvexError({ code: "INVALID_EMAIL", message: "Enter a valid email address." });
    }

    const existingUser = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: email }],
    });
    if (existingUser) {
      const member = await ctx.db
        .query("members")
        .withIndex("by_workspace_and_user", (q) =>
          q.eq("workspaceId", me.workspaceId).eq("userId", String(existingUser._id)),
        )
        .first();
      if (member) {
        throw new ConvexError({ code: "ALREADY_MEMBER", message: `${email} is already a member.` });
      }
    }

    // One live link per email: a new invite replaces any pending one, since links are shown only once.
    const now = Date.now();
    const previous = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    for (const invite of previous) {
      if (invite.workspaceId === me.workspaceId && inviteState(invite, now) === "pending") {
        await ctx.db.patch("invites", invite._id, { revokedAt: now });
      }
    }

    const expiresAt = now + INVITE_TTL_MS;
    const inviteId = await ctx.db.insert("invites", {
      workspaceId: me.workspaceId,
      email,
      tokenHash: args.tokenHash,
      createdBy: me._id,
      expiresAt,
    });
    return { inviteId, expiresAt };
  },
});

/** Owner only. A revoked link stops working at once (sign-up and accept both check it). */
export const revoke = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, { inviteId }) => {
    const me = await requireOwner(ctx);
    const invite = await ctx.db.get("invites", inviteId);
    if (!invite || invite.workspaceId !== me.workspaceId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invite not found." });
    }
    if (invite.acceptedAt !== undefined) {
      throw new ConvexError({ code: "ALREADY_ACCEPTED", message: "This invite was already accepted." });
    }
    if (invite.revokedAt === undefined) await ctx.db.patch("invites", inviteId, { revokedAt: Date.now() });
  },
});

/** Owner only. Newest first, without token hashes. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireOwner(ctx);
    const now = Date.now();
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", me.workspaceId))
      .order("desc")
      .take(100);
    return invites.map((invite) => ({
      _id: invite._id,
      _creationTime: invite._creationTime,
      email: invite.email,
      createdBy: invite.createdBy,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      revokedAt: invite.revokedAt,
      state: inviteState(invite, now),
    }));
  },
});

/**
 * Called right after sign-up (or sign-in) with the token from the link: checks the hash, the
 * email, revocation and expiry, then creates the `members` row. Like `setup.createWorkspace`, it
 * needs a signed-in user rather than a member (documented exception to requireMember).
 */
export const accept = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const userId = await requireAuthUserId(ctx);

    const existing = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    // Already in (e.g. a double submit): nothing to do, and the invite isn't consumed.
    if (existing) return { memberId: existing._id, workspaceId: existing.workspaceId, alreadyMember: true };

    const hash = await sha256Hex(token.trim());
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", hash))
      .first();
    if (!invite) {
      throw new ConvexError({ code: "INVITE_INVALID", message: "This invite link isn't valid. Ask the owner for a new one." });
    }
    const state = inviteState(invite, Date.now());
    if (state === "accepted") {
      throw new ConvexError({ code: "INVITE_USED", message: "This invite link has already been used." });
    }
    if (state === "revoked") {
      throw new ConvexError({ code: "INVITE_REVOKED", message: "This invite link was revoked. Ask the owner for a new one." });
    }
    if (state === "expired") {
      throw new ConvexError({ code: "INVITE_EXPIRED", message: "This invite link has expired. Ask the owner for a new one." });
    }

    const email = await getAuthEmail(ctx);
    if (!email || email !== invite.email) {
      throw new ConvexError({
        code: "INVITE_WRONG_EMAIL",
        message: `This invite is for a different email address. Sign in as ${invite.email} to accept it.`,
      });
    }

    const identity = await ctx.auth.getUserIdentity();
    const displayName = identity?.name?.trim().slice(0, 80) || email.split("@")[0] || "Member";
    const memberId = await ctx.db.insert("members", {
      workspaceId: invite.workspaceId,
      userId,
      displayName,
      ...(identity?.pictureUrl ? { avatarUrl: identity.pictureUrl } : {}),
      role: "member",
    });
    await ctx.db.patch("invites", invite._id, { acceptedAt: Date.now() });
    return { memberId, workspaceId: invite.workspaceId, alreadyMember: false };
  },
});
