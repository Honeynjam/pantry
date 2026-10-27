import type { Doc, Id } from "@pantry/backend/dataModel";
import type { Project } from "@pantry/backend/model";
import { resolveLabelColor } from "@pantry/ui/lib/issue-meta";
import { useMemo } from "react";
import type { WorkspaceData } from "../shell/app-shell";

/** An issue as lists, boards and My issues get it: everything but the description (the issue page loads that). */
export type ListIssue = Omit<Doc<"issues">, "description">;

/** The parts of the workspace data that issue views read. */
export type LookupData = Pick<WorkspaceData, "statuses" | "labels" | "members" | "me" | "projects">;

/** Id → row maps over the workspace data the shell already subscribes to. */
export type Lookups = {
  data: LookupData;
  status: (id: Id<"statuses">) => Doc<"statuses"> | undefined;
  label: (id: Id<"labels">) => Doc<"labels"> | undefined;
  member: (id: Id<"members"> | undefined) => Doc<"members"> | undefined;
  project: (id: Id<"projects"> | undefined) => Project | undefined;
  /** A space's active projects, in order. */
  projectsOf: (spaceId: Id<"spaces"> | undefined) => Project[];
};

/**
 * Built from the parts it uses, not the whole workspace result: creating an issue bumps its space's
 * counter (so `workspace.current` changes), and that shouldn't hand every row new lookups. The shell
 * keeps the parts' identity (`useStable`).
 */
export function useLookups({ statuses, labels, members, me, projects }: WorkspaceData): Lookups {
  return useMemo(() => {
    const statusById = new Map(statuses.map((row) => [row._id, row]));
    const labelById = new Map(labels.map((row) => [row._id, row]));
    const memberById = new Map(members.map((row) => [row._id, row]));
    const projectById = new Map(projects.map((row) => [row._id, row]));
    return {
      data: { statuses, labels, members, me, projects },
      status: (id) => statusById.get(id),
      label: (id) => labelById.get(id),
      member: (id) => (id ? memberById.get(id) : undefined),
      project: (id) => (id ? projectById.get(id) : undefined),
      projectsOf: (spaceId) => (spaceId ? projects.filter((row) => row.spaceId === spaceId) : []),
    };
  }, [statuses, labels, members, me, projects]);
}

/** A status's stored colour (palette name or hex) as CSS. */
export const statusColor = (status: Pick<Doc<"statuses">, "color">) =>
  resolveLabelColor(status.color);
