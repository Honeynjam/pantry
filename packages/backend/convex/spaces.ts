import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { SAMPLE_CONTEXT_DOC } from "./lib/defaults";
import { fail } from "./lib/errors";
import { getSpace } from "./lib/spaces";
import { cleanName, SPACE_KEY_PATTERN } from "./lib/validate";
import { spaceKind } from "./schema";

/**
 * New space (a product or a client) with its context doc. The key is unique per workspace,
 * archived spaces included (their issues keep their keys), and fixed after creation.
 */
export const create = mutation({
  args: { name: v.string(), key: v.string(), kind: v.optional(spaceKind) },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    const name = cleanName(args.name, "Space name");
    const key = args.key.trim().toUpperCase();
    if (!SPACE_KEY_PATTERN.test(key)) {
      fail("INVALID_KEY", "Keys are 2–10 letters or digits and start with a letter, like PAN or WEB2.");
    }
    const taken = await ctx.db
      .query("spaces")
      .withIndex("by_workspace_and_key", (q) => q.eq("workspaceId", me.workspaceId).eq("key", key))
      .first();
    if (taken) {
      fail(
        "KEY_TAKEN",
        taken.archivedAt === undefined
          ? `${key} is already the key of ${taken.name}.`
          : `${key} belongs to an archived space (${taken.name}). Pick another key.`,
      );
    }

    const spaceId = await ctx.db.insert("spaces", {
      workspaceId: me.workspaceId,
      name,
      key,
      nextIssueNumber: 1,
      ...(args.kind && args.kind !== "product" ? { kind: args.kind } : {}),
    });
    await ctx.db.insert("docs", {
      workspaceId: me.workspaceId,
      spaceId,
      kind: "space_context",
      title: `${name} context`,
      body: SAMPLE_CONTEXT_DOC,
      updatedBy: me._id,
      updatedAt: Date.now(),
    });
    return { spaceId, key };
  },
});

/** Rename or change kind. The key can't change (issue keys and agents' references depend on it). */
export const update = mutation({
  args: { spaceId: v.id("spaces"), name: v.optional(v.string()), kind: v.optional(spaceKind) },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    await getSpace(ctx, me.workspaceId, args.spaceId);
    await ctx.db.patch("spaces", args.spaceId, {
      ...(args.name !== undefined ? { name: cleanName(args.name, "Space name") } : {}),
      ...(args.kind !== undefined ? { kind: args.kind } : {}),
    });
  },
});

/** Hides the space from the sidebar and lists; its issues and key stay. */
export const archive = mutation({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    const space = await getSpace(ctx, me.workspaceId, args.spaceId);
    if (space.archivedAt === undefined) await ctx.db.patch("spaces", space._id, { archivedAt: Date.now() });
  },
});
