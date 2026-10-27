import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { fail } from "./errors";
import { nameKey } from "./spaces";

/**
 * By-name lookups for MCP (statuses, labels, members), always inside one workspace and
 * case-insensitive. An unknown name fails with the valid values, so an agent can retry. Spaces and
 * projects are looked up in `lib/spaces.ts`.
 */

const list = (names: string[]) => names.map((name) => `"${name}"`).join(", ");

export async function workspaceStatuses(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return ctx.db
    .query("statuses")
    .withIndex("by_workspace_and_order", (q) => q.eq("workspaceId", workspaceId))
    .collect();
}

export async function workspaceLabels(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return ctx.db
    .query("labels")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
}

export async function workspaceMembers(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return ctx.db
    .query("members")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
}

export async function resolveStatusByName(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  name: string,
) {
  const statuses = await workspaceStatuses(ctx, workspaceId);
  const match = statuses.find((status) => nameKey(status.name) === nameKey(name));
  if (match) return match;
  return fail(
    "UNKNOWN_STATUS",
    `No status "${name.trim()}". Statuses: ${list(statuses.map((status) => status.name))}.`,
  );
}

/** Labels by name, in the order given (duplicates dropped). Labels are never created on the fly. */
export async function resolveLabelsByName(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  names: string[],
): Promise<Doc<"labels">[]> {
  if (names.length === 0) return [];
  const labels = await workspaceLabels(ctx, workspaceId);
  const found = new Map<Id<"labels">, Doc<"labels">>();
  const unknown: string[] = [];
  for (const name of names) {
    const match = labels.find((label) => nameKey(label.name) === nameKey(name));
    if (match) found.set(match._id, match);
    else unknown.push(name.trim());
  }
  if (unknown.length > 0) {
    const valid = labels.map((label) => label.name);
    fail(
      "UNKNOWN_LABEL",
      `No label ${list(unknown)}. ${valid.length ? `Labels: ${list(valid)}.` : "This workspace has no labels yet."} Labels aren't created automatically.`,
    );
  }
  return [...found.values()];
}

/**
 * An assignee: `"me"` (the token's owner), `"none"` (null) or a member's display name. Names can
 * repeat, so two matches are an error too.
 */
export async function resolveAssignee(
  ctx: QueryCtx,
  me: Doc<"members">,
  name: string,
): Promise<Doc<"members"> | null> {
  const key = nameKey(name);
  if (key === "me") return me;
  if (key === "none") return null;
  const members = await workspaceMembers(ctx, me.workspaceId);
  const matches = members.filter((member) => nameKey(member.displayName) === key);
  if (matches.length === 1) return matches[0]!;
  const valid = list(["me", "none", ...members.map((member) => member.displayName)]);
  if (matches.length > 1) {
    return fail(
      "AMBIGUOUS_ASSIGNEE",
      `More than one member is called "${name.trim()}". Use "me" or ask a person to assign it. Members: ${valid}.`,
    );
  }
  return fail("UNKNOWN_ASSIGNEE", `No member called "${name.trim()}". Use one of ${valid}.`);
}
