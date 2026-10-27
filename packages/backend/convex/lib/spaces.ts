import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { fail, notFound } from "./errors";
import { isLegacyProject, isProject, UPGRADING_MESSAGE, type Project } from "./model";

/**
 * Spaces and projects, always resolved inside one workspace ("not found" for anything else).
 * Shared by the app functions and, from M4, the MCP functions, which look both up by name.
 */

/** A space in the workspace, archived or not. */
export async function getSpace(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  spaceId: Id<"spaces">,
): Promise<Doc<"spaces">> {
  const space = await ctx.db.get("spaces", spaceId);
  if (!space || space.workspaceId !== workspaceId) return notFound("Space");
  return space;
}

/** A project (workstream) in the workspace, archived or not. An unmigrated M2 row isn't one. */
export async function getProject(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  projectId: Id<"projects">,
): Promise<Project> {
  const project = await ctx.db.get("projects", projectId);
  if (!project || project.workspaceId !== workspaceId || !isProject(project))
    return notFound("Project");
  return project;
}

/**
 * A project an issue in `space` can use: in the workspace, in that space, not archived.
 * The rule behind `issues.create`, `issues.update` and MCP `create_issue` / `update_issue`.
 */
export async function getProjectForSpace(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  space: Pick<Doc<"spaces">, "_id" | "name">,
  projectId: Id<"projects">,
): Promise<Project> {
  const project = await getProject(ctx, workspaceId, projectId);
  if (project.spaceId !== space._id)
    fail("WRONG_SPACE", `${project.name} is a project in another space, not ${space.name}.`);
  if (project.archivedAt !== undefined) fail("ARCHIVED", `${project.name} is archived.`);
  return project;
}

/** A space's active projects in sidebar order. */
export async function activeProjects(ctx: QueryCtx, spaceId: Id<"spaces">): Promise<Project[]> {
  const rows = await ctx.db
    .query("projects")
    .withIndex("by_space", (q) => q.eq("spaceId", spaceId))
    .collect();
  return rows
    .filter(isProject)
    .filter((row) => row.archivedAt === undefined)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Whether the workspace still has M2 rows waiting for `migrations:run`. */
export async function upgradePending(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
): Promise<boolean> {
  const rows = await ctx.db
    .query("projects")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  return rows.some(isLegacyProject);
}

/** Case-insensitive, whitespace-normalised name key for uniqueness and lookups. */
export const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** A space by key (`PAN`, any case) for MCP: valid keys are listed when it doesn't exist. */
export async function resolveSpaceByKey(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  key: string,
): Promise<Doc<"spaces">> {
  const upper = key.trim().toUpperCase();
  const space = await ctx.db
    .query("spaces")
    .withIndex("by_workspace_and_key", (q) => q.eq("workspaceId", workspaceId).eq("key", upper))
    .first();
  if (space && space.archivedAt === undefined) return space;
  // During the upgrade window the key may still belong to an M2 project.
  if (!space && (await upgradePending(ctx, workspaceId)))
    return fail("UPGRADING", UPGRADING_MESSAGE);
  const all = await ctx.db
    .query("spaces")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const keys = all.filter((row) => row.archivedAt === undefined).map((row) => row.key);
  return fail(
    "UNKNOWN_SPACE",
    `No space with the key "${key.trim()}". Spaces: ${keys.join(", ") || "none"}.`,
  );
}

/**
 * A project by name (any case) inside one space, for MCP. `"none"` means no project (null). An
 * unknown name fails with the space's valid project names, so an agent can retry.
 */
export async function resolveProjectByName(
  ctx: QueryCtx,
  space: Pick<Doc<"spaces">, "_id" | "key">,
  name: string,
): Promise<Project | null> {
  if (nameKey(name) === "none") return null;
  const projects = await activeProjects(ctx, space._id);
  const match = projects.find((project) => nameKey(project.name) === nameKey(name));
  if (match) return match;
  const valid = projects.map((project) => project.name);
  return fail(
    "UNKNOWN_PROJECT",
    valid.length
      ? `No project "${name.trim()}" in ${space.key}. Projects in ${space.key}: ${valid.join(", ")} (or "none").`
      : `${space.key} has no projects yet. Use "none" or leave the project out.`,
  );
}
