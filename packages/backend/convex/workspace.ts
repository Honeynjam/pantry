import { query } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { activeProjects, upgradePending } from "./lib/spaces";

/**
 * Everything the app shell needs in one subscription: the workspace, my member row, statuses (by
 * order), labels, members, active spaces and their active projects (spec §10b).
 */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireMember(ctx);
    const workspace = await ctx.db.get("workspaces", me.workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    const [statuses, labels, members, spaces] = await Promise.all([
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
        .query("spaces")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect(),
    ]);
    const activeSpaces = spaces.filter((space) => space.archivedAt === undefined);
    const projects = (await Promise.all(activeSpaces.map((space) => activeProjects(ctx, space._id)))).flat();

    return {
      workspace,
      me,
      statuses,
      labels,
      members,
      spaces: activeSpaces,
      /** M2 data still waiting for `migrations:run` (seconds after a deploy): the app shows a notice. */
      upgrading: await upgradePending(ctx, workspace._id),
      /** Active projects of active spaces, in each space's order. */
      projects,
    };
  },
});
