import { query } from "./_generated/server";
import { requireMember } from "./lib/auth";

/**
 * Everything the app shell needs in one subscription: the workspace, my member row, statuses (by
 * order), labels, members and active projects (spec §10b).
 */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireMember(ctx);
    const workspace = await ctx.db.get("workspaces", me.workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    const [statuses, labels, members, projects] = await Promise.all([
      ctx.db
        .query("statuses")
        .withIndex("by_workspace_and_order", (q) => q.eq("workspaceId", workspace._id))
        .collect(),
      ctx.db
        .query("labels")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect(),
      ctx.db
        .query("members")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect(),
      ctx.db
        .query("projects")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect(),
    ]);

    return {
      workspace,
      me,
      statuses,
      labels,
      members,
      projects: projects.filter((project) => project.archivedAt === undefined),
    };
  },
});
