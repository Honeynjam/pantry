import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { requireMember } from "./lib/auth";
import { fail, notFound } from "./lib/errors";
import { checkColor, cleanName } from "./lib/validate";

async function workspaceLabels(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  return ctx.db
    .query("labels")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
}

/** Label names are unique per workspace, ignoring case: agents pick labels by name over MCP. */
function assertNameFree(labels: Doc<"labels">[], name: string, except?: Id<"labels">) {
  const clash = labels.find((label) => label._id !== except && label.name.toLowerCase() === name.toLowerCase());
  if (clash) fail("NAME_TAKEN", `There's already a label called ${clash.name}.`);
}

export const create = mutation({
  args: { name: v.string(), color: v.string() },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    const name = cleanName(args.name, "Label name", 40);
    assertNameFree(await workspaceLabels(ctx, me.workspaceId), name);
    return ctx.db.insert("labels", { workspaceId: me.workspaceId, name, color: checkColor(args.color) });
  },
});

export const update = mutation({
  args: { labelId: v.id("labels"), name: v.optional(v.string()), color: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    const label = await ctx.db.get("labels", args.labelId);
    if (!label || label.workspaceId !== me.workspaceId) return notFound("Label");
    const patch: Partial<Doc<"labels">> = {};
    if (args.name !== undefined) {
      patch.name = cleanName(args.name, "Label name", 40);
      assertNameFree(await workspaceLabels(ctx, me.workspaceId), patch.name, label._id);
    }
    if (args.color !== undefined) patch.color = checkColor(args.color);
    await ctx.db.patch("labels", label._id, patch);
  },
});

/**
 * Deletes the label and pulls it from every issue's `labelIds`. Each issue that loses it is an
 * issue write, so it gets `updatedAt` and one `labels_changed` activity row.
 */
export const remove = mutation({
  args: { labelId: v.id("labels") },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx);
    const label = await ctx.db.get("labels", args.labelId);
    if (!label || label.workspaceId !== me.workspaceId) return notFound("Label");

    const names = new Map((await workspaceLabels(ctx, me.workspaceId)).map((row) => [row._id, row.name]));
    const issues = await ctx.db
      .query("issues")
      .withIndex("by_workspace_and_updated", (q) => q.eq("workspaceId", me.workspaceId))
      .collect();
    const now = Date.now();
    for (const issue of issues) {
      if (!issue.labelIds.includes(label._id)) continue;
      const labelIds = issue.labelIds.filter((id) => id !== label._id);
      await ctx.db.patch("issues", issue._id, { labelIds, updatedAt: now });
      await logActivity(ctx, { member: me, via: "app" }, issue, "labels_changed", {
        from: issue.labelIds.map((id) => names.get(id) ?? "").filter(Boolean).join(", "),
        to: labelIds.map((id) => names.get(id) ?? "").filter(Boolean).join(", "),
      });
    }
    await ctx.db.delete("labels", label._id);
  },
});
