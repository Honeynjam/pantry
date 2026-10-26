import type { Doc, Id } from "@pantry/backend/dataModel";
import type { Project } from "@pantry/backend/model";
import { resolveLabelColor } from "@pantry/ui/lib/issue-meta";
import { useMemo } from "react";
import type { WorkspaceData } from "../shell/app-shell";

/** An issue as lists, boards and My issues get it: everything but the description (the issue page loads that). */
export type ListIssue = Omit<Doc<"issues">, "description">;

/** Id → row maps over the workspace data the shell already subscribes to. */
export type Lookups = {
  data: WorkspaceData;
  status: (id: Id<"statuses">) => Doc<"statuses"> | undefined;
  label: (id: Id<"labels">) => Doc<"labels"> | undefined;
  member: (id: Id<"members"> | undefined) => Doc<"members"> | undefined;
  project: (id: Id<"projects"> | undefined) => Project | undefined;
  /** A space's active projects, in order. */
  projectsOf: (spaceId: Id<"spaces"> | undefined) => Project[];
};

export function useLookups(data: WorkspaceData): Lookups {
  return useMemo(() => {
    const statuses = new Map(data.statuses.map((row) => [row._id, row]));
    const labels = new Map(data.labels.map((row) => [row._id, row]));
    const members = new Map(data.members.map((row) => [row._id, row]));
    const projects = new Map(data.projects.map((row) => [row._id, row]));
    return {
      data,
      status: (id) => statuses.get(id),
      label: (id) => labels.get(id),
      member: (id) => (id ? members.get(id) : undefined),
      project: (id) => (id ? projects.get(id) : undefined),
      projectsOf: (spaceId) => (spaceId ? data.projects.filter((row) => row.spaceId === spaceId) : []),
    };
  }, [data]);
}

/** A status's stored colour (palette name or hex) as CSS. */
export const statusColor = (status: Pick<Doc<"statuses">, "color">) => resolveLabelColor(status.color);
