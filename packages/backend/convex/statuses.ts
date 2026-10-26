import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { fail, notFound } from "./lib/errors";
import { checkColor, cleanName } from "./lib/validate";

/**
 * The six statuses are fixed in v0.1 (one per category): rename, recolour and reorder only. Names
 * stay unique, ignoring case, because agents set status by name over MCP.
 */
export const update = mutation({
  args: { statusId: v.id("statuses"), name: v.optional(v.string()), color: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    const status = await ctx.db.get("statuses", args.statusId);
    if (!status || status.workspaceId !== me.workspaceId) return notFound("Status");
    const patch: Partial<Doc<"statuses">> = {};
    if (args.name !== undefined) {
      const name = cleanName(args.name, "Status name", 40);
      const all = await ctx.db
        .query("statuses")
        .withIndex("by_workspace_and_order", (q) => q.eq("workspaceId", me.workspaceId))
        .collect();
      const clash = all.find((row) => row._id !== status._id && row.name.toLowerCase() === name.toLowerCase());
      if (clash) fail("NAME_TAKEN", `There's already a status called ${clash.name}.`);
      patch.name = name;
    }
    if (args.color !== undefined) patch.color = checkColor(args.color);
    await ctx.db.patch("statuses", status._id, patch);
  },
});

/** New order for all of the workspace's statuses: `statusIds` must list each exactly once. */
export const reorder = mutation({
  args: { statusIds: v.array(v.id("statuses")) },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    const all = await ctx.db
      .query("statuses")
      .withIndex("by_workspace_and_order", (q) => q.eq("workspaceId", me.workspaceId))
      .collect();
    const known = new Set(all.map((status) => status._id));
    const given = new Set(args.statusIds);
    if (given.size !== args.statusIds.length || given.size !== known.size || args.statusIds.some((id) => !known.has(id))) {
      fail("INVALID_ORDER", "Reorder needs every status exactly once.");
    }
    for (const [order, statusId] of args.statusIds.entries()) {
      const status = all.find((row) => row._id === statusId)!;
      if (status.order !== order) await ctx.db.patch("statuses", statusId, { order });
    }
  },
});
