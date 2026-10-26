import type { Doc, Id } from "../_generated/dataModel";
import { fail } from "./errors";

/**
 * Narrow views over the transitional schema (see schema.ts and docs/MIGRATIONS.md). The `projects`
 * table still holds M2 rows until `migrations:run` has moved them to `spaces`; every function reads
 * through these guards, so an M2 row is never mistaken for a workstream.
 */

/** A project: a workstream inside a space. */
export type Project = Extract<Doc<"projects">, { spaceId: Id<"spaces"> }>;

/** An M2 project (now a space) that hasn't been migrated yet. */
export type LegacyProject = Exclude<Doc<"projects">, Project>;

export function isProject(row: Doc<"projects">): row is Project {
  return "spaceId" in row && row.spaceId !== undefined;
}

export function isLegacyProject(row: Doc<"projects">): row is LegacyProject {
  return !isProject(row);
}

/** An issue that has been migrated (every issue created since the Spaces release). */
export type SpacedIssue = Doc<"issues"> & { spaceId: Id<"spaces"> };

export function hasSpace(issue: Doc<"issues">): issue is SpacedIssue {
  return issue.spaceId !== undefined;
}

/** Shown while M2 data waits for `migrations:run` (seconds, right after a deploy). */
export const UPGRADING_MESSAGE = "This workspace is finishing an upgrade. Try again in a minute.";

/** The issue's space; an M2 issue that hasn't been migrated yet can't be changed. */
export function issueSpaceId(issue: Doc<"issues">): Id<"spaces"> {
  if (!hasSpace(issue)) return fail("UPGRADING", UPGRADING_MESSAGE);
  return issue.spaceId;
}
