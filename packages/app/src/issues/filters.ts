import type { Doc, Id } from "@pantry/backend/dataModel";
import type { Project } from "@pantry/backend/model";
import { PRIORITIES, type Priority } from "@pantry/ui/lib/issue-meta";
import type { ListIssue } from "./lookups";

/**
 * List and board filters (spec §3, §4): status, assignee, label and priority, plus `/`'s title
 * text. They live in the URL (so they survive a reload and can be shared) and apply client-side
 * to the issues already loaded. Within a facet any value matches; across facets all must.
 *
 *   ?status=todo,in-review&assignee=me,none,<memberId>&label=bug&priority=urgent,high&project=launch,none&q=login
 *
 * Statuses, labels and projects go by name (unique per workspace, or per space for projects, so
 * readable and unambiguous); a rename drops them from old links. People go by id, since display
 * names can repeat. `group=project` (list and board grouping) lives next to them but isn't a filter.
 */
export type AssigneeFilter = "me" | "none" | Id<"members">;

export type Filters = {
  /** Status name slugs. */
  status: string[];
  assignee: AssigneeFilter[];
  /** Label name slugs. */
  label: string[];
  priority: Priority[];
  /** Project name slugs in the current space, or "none". */
  project: string[];
  q: string;
};

/** "In Review" → "in-review". */
export const slug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-");

export type FilterFacet = Exclude<keyof Filters, "q">;

export const EMPTY_FILTERS: Filters = { status: [], assignee: [], label: [], priority: [], project: [], q: "" };

/** Priority names in URLs: readable, and stable if the numbering ever changes. */
const PRIORITY_PARAM: Record<Priority, string> = { 0: "none", 1: "urgent", 2: "high", 3: "medium", 4: "low" };
const PRIORITY_FROM_PARAM = new Map(PRIORITIES.map((priority) => [PRIORITY_PARAM[priority], priority]));

const list = (value: string | null) => (value ? value.split(",").map((part) => part.trim()).filter(Boolean) : []);
const unique = <T>(values: T[]) => [...new Set(values)];

export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  return {
    status: unique(list(params.get("status")).map(slug)),
    assignee: unique(list(params.get("assignee"))) as AssigneeFilter[],
    label: unique(list(params.get("label")).map(slug)),
    priority: unique(
      list(params.get("priority"))
        .map((name) => PRIORITY_FROM_PARAM.get(name.toLowerCase()))
        .filter((priority) => priority !== undefined),
    ),
    project: unique(list(params.get("project")).map(slug)),
    q: params.get("q") ?? "",
  };
}

/**
 * The query string for `filters`, keeping any other params in `search` (e.g. a future view
 * param). Empty facets are left out; returns "" or "?…".
 */
export function serializeFilters(filters: Filters, search = ""): string {
  const params = new URLSearchParams(search);
  const set = (key: string, values: string[]) => (values.length ? params.set(key, values.join(",")) : params.delete(key));
  set("status", filters.status);
  set("assignee", filters.assignee);
  set("label", filters.label);
  set("priority", filters.priority.map((priority) => PRIORITY_PARAM[priority]));
  set("project", filters.project);
  if (filters.q.trim()) params.set("q", filters.q);
  else params.delete("q");
  // Commas stay readable in the address bar.
  const query = params.toString().replace(/%2C/g, ",");
  return query ? `?${query}` : "";
}

export function hasFilters(filters: Filters): boolean {
  return (
    filters.status.length + filters.assignee.length + filters.label.length + filters.priority.length + filters.project.length > 0 ||
    filters.q.trim() !== ""
  );
}

export function toggleValue<F extends FilterFacet>(filters: Filters, facet: F, value: Filters[F][number]): Filters {
  const current = filters[facet] as Array<Filters[F][number]>;
  const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  return { ...filters, [facet]: next };
}

export type FilterContext = {
  me: Id<"members">;
  statuses: ReadonlyArray<Pick<Doc<"statuses">, "_id" | "name">>;
  labels: ReadonlyArray<Pick<Doc<"labels">, "_id" | "name">>;
  /** The current space's projects (names are unique per space). */
  projects?: ReadonlyArray<Pick<Project, "_id" | "name">>;
};

/** The issues that pass every active facet and contain every word of the title text. */
export function applyFilters<T extends ListIssue>(issues: ReadonlyArray<T>, filters: Filters, context: FilterContext): T[] {
  const words = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
  // Names to ids. A name that matches nothing (renamed, deleted) still filters, to nothing.
  const byName = (rows: ReadonlyArray<{ _id: string; name: string }>, slugs: string[]) =>
    new Set<string>(rows.filter((row) => slugs.includes(slug(row.name))).map((row) => row._id));
  const status = byName(context.statuses, filters.status);
  const label = byName(context.labels, filters.label);
  const project = byName(context.projects ?? [], filters.project);
  const noProject = filters.project.includes("none");
  const priority = new Set(filters.priority);
  const assignee = new Set<string>(filters.assignee.map((value) => (value === "me" ? context.me : value)));
  return issues.filter((issue) => {
    if (filters.status.length && !status.has(issue.statusId)) return false;
    if (filters.priority.length && !priority.has(issue.priority)) return false;
    if (filters.label.length && !issue.labelIds.some((id) => label.has(id))) return false;
    if (filters.assignee.length && !assignee.has(issue.assigneeId ?? "none")) return false;
    if (filters.project.length && !(issue.projectId ? project.has(issue.projectId) : noProject)) return false;
    if (words.length) {
      const haystack = `${issue.key} ${issue.title}`.toLowerCase();
      if (!words.every((word) => haystack.includes(word))) return false;
    }
    return true;
  });
}

/** List and board grouping: by status (the default) or by project (spaces only). */
export type GroupBy = "status" | "project";

export function parseGroup(search: string): GroupBy {
  return new URLSearchParams(search).get("group") === "project" ? "project" : "status";
}

export function serializeGroup(group: GroupBy, search: string): string {
  const params = new URLSearchParams(search);
  if (group === "project") params.set("group", "project");
  else params.delete("group");
  const query = params.toString().replace(/%2C/g, ",");
  return query ? `?${query}` : "";
}
