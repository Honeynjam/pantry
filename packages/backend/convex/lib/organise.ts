import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Actor } from "./activity";
import type { avatarValidator } from "./avatar";
import { SAMPLE_CONTEXT_DOC } from "./defaults";
import { fail } from "./errors";
import { setIssueProject } from "./issues";
import type { Project } from "./model";
import { activeProjects, nameKey } from "./spaces";
import { checkColor, cleanName, SPACE_KEY_PATTERN } from "./validate";

/**
 * Organising a workspace: spaces, their context docs, projects and labels. Shared by the app's
 * `spaces.*`, `docs.saveContext`, `projects.*` and `labels.create` and by the MCP tools that do the
 * same things, so both follow one set of rules. Callers check membership (`requireMember` or
 * `requireToken`) and resolve the space or project inside the caller's workspace first.
 */

type Kind = NonNullable<Doc<"spaces">["kind"]>;
type Avatar = Infer<typeof avatarValidator>;

// ---------------------------------------------------------------------------------------------
// Spaces
// ---------------------------------------------------------------------------------------------

/**
 * New space with its context doc. The key is unique per workspace, archived spaces included (their
 * issues keep their keys), and fixed after creation. Without an avatar the space gets a look seeded
 * from its key.
 */
export async function createSpace(
  ctx: MutationCtx,
  me: Doc<"members">,
  args: { name: string; key: string; kind?: Kind; avatar?: Avatar },
) {
  const name = cleanName(args.name, "Space name");
  const key = args.key.trim().toUpperCase();
  if (!SPACE_KEY_PATTERN.test(key)) {
    fail(
      "INVALID_KEY",
      "Keys are 2–10 letters or digits and start with a letter, like PAN or WEB2.",
    );
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
    ...(args.avatar ? { avatar: args.avatar } : {}),
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
  return { spaceId, key, name };
}

/** Rename or change kind. The key can't change (issue keys and agents' references depend on it). */
export async function updateSpace(
  ctx: MutationCtx,
  space: Doc<"spaces">,
  args: { name?: string; kind?: Kind },
) {
  await ctx.db.patch("spaces", space._id, {
    ...(args.name !== undefined ? { name: cleanName(args.name, "Space name") } : {}),
    ...(args.kind !== undefined ? { kind: args.kind } : {}),
  });
}

export const MAX_CONTEXT_DOC = 100_000;

/** Replaces the space's context doc (markdown); creates it if an old space has none. */
export async function saveSpaceContext(
  ctx: MutationCtx,
  me: Doc<"members">,
  space: Doc<"spaces">,
  body: string,
) {
  if (body.length > MAX_CONTEXT_DOC)
    fail(
      "TOO_LONG",
      `The context doc can be at most ${MAX_CONTEXT_DOC.toLocaleString("en")} characters.`,
    );
  const doc = await ctx.db
    .query("docs")
    .withIndex("by_space_and_kind", (q) => q.eq("spaceId", space._id).eq("kind", "space_context"))
    .first();
  const now = Date.now();
  if (doc) {
    if (doc.body === body) return doc.updatedAt;
    await ctx.db.patch("docs", doc._id, { body, updatedBy: me._id, updatedAt: now });
  } else {
    await ctx.db.insert("docs", {
      workspaceId: me.workspaceId,
      spaceId: space._id,
      kind: "space_context",
      title: `${space.name} context`,
      body,
      updatedBy: me._id,
      updatedAt: now,
    });
  }
  return now;
}

// ---------------------------------------------------------------------------------------------
// Projects (workstreams inside a space)
// ---------------------------------------------------------------------------------------------

/** Names are unique per space among active projects, ignoring case (MCP finds them by name). */
async function checkProjectNameFree(
  ctx: QueryCtx,
  spaceId: Id<"spaces">,
  name: string,
  except?: Id<"projects">,
) {
  const taken = (await activeProjects(ctx, spaceId)).find(
    (project) => project._id !== except && nameKey(project.name) === nameKey(name),
  );
  if (taken) fail("NAME_TAKEN", `There's already a project called ${taken.name} in this space.`);
}

/** New project at the end of the space's order. The space must be active. */
export async function createProject(
  ctx: MutationCtx,
  space: Doc<"spaces">,
  args: { name: string; color?: string },
) {
  if (space.archivedAt !== undefined) fail("ARCHIVED", `${space.name} is archived.`);
  const name = cleanName(args.name, "Project name", 60);
  await checkProjectNameFree(ctx, space._id, name);
  const last = (await activeProjects(ctx, space._id)).at(-1);
  const projectId = await ctx.db.insert("projects", {
    workspaceId: space.workspaceId,
    spaceId: space._id,
    name,
    ...(args.color !== undefined ? { color: checkColor(args.color) } : {}),
    sortOrder: (last?.sortOrder ?? 0) + 1,
  });
  return { projectId, name };
}

/** Rename and recolour (`color: null` removes the colour). */
export async function updateProject(
  ctx: MutationCtx,
  project: Project,
  args: { name?: string; color?: string | null },
) {
  const patch: Partial<Project> = {};
  if (args.name !== undefined) {
    const name = cleanName(args.name, "Project name", 60);
    if (project.archivedAt === undefined)
      await checkProjectNameFree(ctx, project.spaceId, name, project._id);
    patch.name = name;
  }
  if (args.color !== undefined)
    patch.color = args.color === null ? undefined : checkColor(args.color);
  await ctx.db.patch("projects", project._id, patch);
}

/**
 * Archive: the project leaves the sidebar and pickers, and every issue in it stays in the space with
 * no project (each an issue write by `actor`: `updatedAt` and one `project_changed` row). Returns how
 * many issues (sub-issues included) left the project.
 */
export async function archiveProject(ctx: MutationCtx, actor: Actor, project: Project) {
  if (project.archivedAt !== undefined) return 0;
  const issues = await ctx.db
    .query("issues")
    .withIndex("by_project", (q) => q.eq("projectId", project._id))
    .collect();
  const now = Date.now();
  for (const issue of issues) {
    // Sub-issues are cleared along with their parent; re-read so none is written twice.
    const current = await ctx.db.get("issues", issue._id);
    if (current?.projectId === project._id) await setIssueProject(ctx, actor, current, null, now);
  }
  await ctx.db.patch("projects", project._id, { archivedAt: now });
  return issues.length;
}

// ---------------------------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------------------------

export async function workspaceLabelRows(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return ctx.db
    .query("labels")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
}

/** Label names are unique per workspace, ignoring case: agents pick labels by name over MCP. */
export function assertLabelNameFree(labels: Doc<"labels">[], name: string, except?: Id<"labels">) {
  const clash = labels.find(
    (label) => label._id !== except && label.name.toLowerCase() === name.toLowerCase(),
  );
  if (clash) fail("NAME_TAKEN", `There's already a label called ${clash.name}.`);
}

export async function createLabel(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  args: { name: string; color: string },
) {
  const name = cleanName(args.name, "Label name", 40);
  assertLabelNameFree(await workspaceLabelRows(ctx, workspaceId), name);
  const labelId = await ctx.db.insert("labels", {
    workspaceId,
    name,
    color: checkColor(args.color),
  });
  return { labelId, name };
}
