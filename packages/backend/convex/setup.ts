import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";
import { DEFAULT_STATUSES, SAMPLE_CONTEXT_DOC, SAMPLE_PROJECT, slugify } from "./lib/defaults";

const MAX_NAME_LENGTH = 80;

/**
 * Whether this instance still needs first-run setup (no members yet).
 * Public and unauthenticated on purpose: the setup screen calls it before anyone can sign in.
 * It returns a single boolean and nothing else.
 */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const anyMember = await ctx.db.query("members").first();
    return { needsSetup: anyMember === null };
  },
});

/**
 * First-run bootstrap: the first signed-in user becomes the owner of the instance's only workspace,
 * with the six default statuses and a sample project plus its context doc.
 *
 * Exception to "every public function calls requireMember": no member exists yet, so this checks for
 * a signed-in Better Auth user instead and refuses once any member exists.
 */
export const createWorkspace = mutation({
  args: {
    workspaceName: v.optional(v.string()),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const anyMember = await ctx.db.query("members").first();
    if (anyMember) {
      throw new ConvexError({
        code: "ALREADY_SET_UP",
        message: "This instance already has a workspace. Ask its owner for an invite.",
      });
    }

    const identity = await ctx.auth.getUserIdentity();
    const displayName =
      cleanName(args.displayName) ??
      cleanName(identity?.name) ??
      emailName(identity?.email) ??
      "Owner";
    const workspaceName = cleanName(args.workspaceName) ?? `${displayName}'s workspace`;

    const workspaceId = await ctx.db.insert("workspaces", {
      name: workspaceName,
      slug: slugify(workspaceName),
      createdBy: userId,
    });

    const ownerId = await ctx.db.insert("members", {
      workspaceId,
      userId,
      displayName,
      ...(identity?.pictureUrl ? { avatarUrl: identity.pictureUrl } : {}),
      role: "owner",
    });

    for (const [order, status] of DEFAULT_STATUSES.entries()) {
      await ctx.db.insert("statuses", { workspaceId, ...status, order });
    }

    const projectId = await ctx.db.insert("projects", {
      workspaceId,
      name: SAMPLE_PROJECT.name,
      key: SAMPLE_PROJECT.key,
      nextIssueNumber: 1,
    });

    await ctx.db.insert("docs", {
      workspaceId,
      projectId,
      kind: "project_context",
      title: `${SAMPLE_PROJECT.name} context`,
      body: SAMPLE_CONTEXT_DOC,
      updatedBy: ownerId,
      updatedAt: Date.now(),
    });

    return { workspaceId, memberId: ownerId, projectId };
  },
});

function cleanName(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim().replace(/\s+/g, " ");
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_NAME_LENGTH);
}

function emailName(email: string | undefined | null): string | undefined {
  return cleanName(email?.split("@")[0]);
}
