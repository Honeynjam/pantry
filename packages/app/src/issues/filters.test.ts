import type { Doc, Id } from "@pantry/backend/dataModel";
import { describe, expect, it } from "vitest";
import {
  applyFilters,
  EMPTY_FILTERS,
  hasFilters,
  parseFilters,
  parseGroup,
  serializeFilters,
  serializeGroup,
  toggleValue,
} from "./filters";

const me = "m-me" as Id<"members">;
const issue = (n: number, extra: Partial<Doc<"issues">>) =>
  ({
    _id: `i-${n}`,
    key: `PAN-${n}`,
    title: `Issue ${n}`,
    statusId: "s-todo",
    priority: 0,
    labelIds: [],
    ...extra,
  }) as unknown as Doc<"issues">;

const issues = [
  issue(1, {
    title: "Fix login redirect",
    assigneeId: me,
    priority: 1,
    labelIds: ["l-bug" as Id<"labels">],
  }),
  issue(2, { title: "Login page copy", statusId: "s-doing" as Id<"statuses">, priority: 3 }),
  issue(3, {
    title: "Footer links",
    assigneeId: "m-other" as Id<"members">,
    priority: 1,
    labelIds: ["l-docs" as Id<"labels">],
  }),
];
const keys = (rows: Doc<"issues">[]) => rows.map((row) => row.key);
const context = {
  me,
  statuses: [
    { _id: "s-todo" as Id<"statuses">, name: "Todo" },
    { _id: "s-doing" as Id<"statuses">, name: "In Progress" },
  ],
  labels: [
    { _id: "l-bug" as Id<"labels">, name: "Bug" },
    { _id: "l-docs" as Id<"labels">, name: "Docs" },
  ],
};

describe("URL filters", () => {
  it("round-trips through the query string, readable and stable", () => {
    const filters = {
      status: ["todo", "in-progress"],
      assignee: ["me", "none"],
      label: ["bug"],
      priority: [1, 2],
      project: ["launch", "none"],
      q: "login page",
    } as unknown as typeof EMPTY_FILTERS;
    const search = serializeFilters(filters);
    expect(search).toBe(
      "?status=todo,in-progress&assignee=me,none&label=bug&priority=urgent,high&project=launch,none&q=login+page",
    );
    expect(parseFilters(search)).toEqual(filters);
  });

  it("drops empty facets, ignores unknown priorities and keeps other params", () => {
    expect(serializeFilters(EMPTY_FILTERS)).toBe("");
    expect(serializeFilters({ ...EMPTY_FILTERS, priority: [4] }, "?view=compact&status=x")).toBe(
      "?view=compact&priority=low",
    );
    expect(parseFilters("?priority=urgent,bogus,URGENT").priority).toEqual([1]);
    expect(parseFilters("")).toEqual(EMPTY_FILTERS);
  });

  it("knows when any filter is on, and toggles values", () => {
    expect(hasFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasFilters({ ...EMPTY_FILTERS, q: "  " })).toBe(false);
    const on = toggleValue(EMPTY_FILTERS, "priority", 1);
    expect(on.priority).toEqual([1]);
    expect(toggleValue(on, "priority", 1).priority).toEqual([]);
    expect(EMPTY_FILTERS.priority).toEqual([]);
  });

  it("matches any value within a facet and every facet together", () => {
    expect(keys(applyFilters(issues, EMPTY_FILTERS, context))).toEqual(["PAN-1", "PAN-2", "PAN-3"]);
    expect(keys(applyFilters(issues, parseFilters("?priority=urgent"), context))).toEqual([
      "PAN-1",
      "PAN-3",
    ]);
    expect(
      keys(applyFilters(issues, parseFilters("?priority=urgent&assignee=me"), context)),
    ).toEqual(["PAN-1"]);
    expect(keys(applyFilters(issues, parseFilters("?assignee=none"), context))).toEqual(["PAN-2"]);
    expect(keys(applyFilters(issues, parseFilters("?assignee=me,none"), context))).toEqual([
      "PAN-1",
      "PAN-2",
    ]);
    expect(keys(applyFilters(issues, parseFilters("?label=bug,DOCS"), context))).toEqual([
      "PAN-1",
      "PAN-3",
    ]);
    expect(keys(applyFilters(issues, parseFilters("?status=in-progress"), context))).toEqual([
      "PAN-2",
    ]);
    // A status that no longer exists (renamed) matches nothing rather than being ignored.
    expect(keys(applyFilters(issues, parseFilters("?status=doing"), context))).toEqual([]);
  });

  it("filters by project name, or none", () => {
    const withProjects = [
      issue(1, { projectId: "p-launch" as Id<"projects"> }),
      issue(2, { projectId: "p-social" as Id<"projects"> }),
      issue(3, {}),
    ];
    const ctx = {
      ...context,
      projects: [
        { _id: "p-launch" as Id<"projects">, name: "Launch" },
        { _id: "p-social" as Id<"projects">, name: "Social media" },
      ],
    };
    expect(keys(applyFilters(withProjects, parseFilters("?project=launch"), ctx))).toEqual([
      "PAN-1",
    ]);
    expect(
      keys(applyFilters(withProjects, parseFilters("?project=social-media,none"), ctx)),
    ).toEqual(["PAN-2", "PAN-3"]);
    expect(keys(applyFilters(withProjects, parseFilters("?project=gone"), ctx))).toEqual([]);
    expect(parseGroup("?group=project&q=x")).toBe("project");
    expect(parseGroup("?group=nonsense")).toBe("status");
    expect(serializeGroup("project", "?q=x")).toBe("?q=x&group=project");
    expect(serializeGroup("status", "?q=x&group=project")).toBe("?q=x");
  });

  it("filters by title words (and key), any case", () => {
    expect(keys(applyFilters(issues, parseFilters("?q=LOGIN"), context))).toEqual([
      "PAN-1",
      "PAN-2",
    ]);
    expect(keys(applyFilters(issues, parseFilters("?q=login+fix"), context))).toEqual(["PAN-1"]);
    expect(keys(applyFilters(issues, parseFilters("?q=pan-3"), context))).toEqual(["PAN-3"]);
  });
});
