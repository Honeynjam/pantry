import { api } from "@pantry/backend/api";
import type { Doc, Id, TableNames } from "@pantry/backend/dataModel";
import type { OptimisticLocalStore } from "convex/browser";
import { getFunctionName, type FunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import { optimisticComment, optimisticMove, optimisticUpdate, placeInColumn } from "./optimistic";

/** Deep-freeze, so any in-place change to a cached result throws in strict mode. */
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

/** A fake OptimisticLocalStore over a map of frozen query results. */
function fakeStore() {
  const results = new Map<string, { query: string; args: unknown; value: unknown }>();
  const key = (query: FunctionReference<"query">, args: unknown) =>
    `${getFunctionName(query)}:${JSON.stringify(args)}`;
  const store = {
    getQuery: (query: FunctionReference<"query">, args: unknown = {}) =>
      results.get(key(query, args))?.value,
    getAllQueries: (query: FunctionReference<"query">) =>
      [...results.values()]
        .filter((entry) => entry.query === getFunctionName(query))
        .map(({ args, value }) => ({ args, value })),
    setQuery: (query: FunctionReference<"query">, args: unknown, value: unknown) =>
      results.set(key(query, args), { query: getFunctionName(query), args, value: freeze(value) }),
  };
  return store as unknown as OptimisticLocalStore & {
    setQuery: (q: unknown, a: unknown, v: unknown) => void;
  };
}

const id = <T extends TableNames>(value: string) => value as Id<T>;
const statuses = (["backlog", "unstarted", "started", "review", "done", "canceled"] as const).map(
  (category, order) => ({
    _id: id<"statuses">(`s-${category}`),
    _creationTime: 0,
    workspaceId: id<"workspaces">("w"),
    name: category,
    category,
    order,
    color: "gray",
  }),
);
const me = {
  _id: id<"members">("m-me"),
  _creationTime: 0,
  workspaceId: id<"workspaces">("w"),
  userId: "u",
  displayName: "Me",
  role: "owner" as const,
};
const other = { ...me, _id: id<"members">("m-other"), displayName: "Other" };

function issue(
  n: number,
  category: (typeof statuses)[number]["category"],
  sortOrder: number,
  extra: Partial<Doc<"issues">> = {},
): Doc<"issues"> {
  return {
    _id: id<"issues">(`i-${n}`),
    _creationTime: n,
    workspaceId: id<"workspaces">("w"),
    spaceId: id<"spaces">("sp"),
    number: n,
    key: `PAN-${n}`,
    title: `Issue ${n}`,
    description: "",
    statusId: id<"statuses">(`s-${category}`),
    statusCategory: category,
    priority: 0,
    creatorId: me._id,
    labelIds: [],
    sortOrder,
    updatedAt: 100,
    ...extra,
  };
}

function setUp() {
  const store = fakeStore();
  const list = [
    issue(1, "unstarted", 1, { assigneeId: me._id }),
    issue(2, "unstarted", 2),
    issue(3, "started", 1, { assigneeId: me._id }),
  ];
  store.setQuery(
    api.workspace.current,
    {},
    { me, statuses, members: [me, other], labels: [], spaces: [], projects: [] },
  );
  store.setQuery(api.issues.listBySpace, { spaceId: id<"spaces">("sp") }, list);
  store.setQuery(api.issues.listMine, {}, [list[2], list[0]]);
  store.setQuery(
    api.issues.get,
    { key: "PAN-1" },
    {
      issue: list[0],
      space: null,
      project: null,
      parent: null,
      subIssues: [],
      comments: [],
      activity: [],
    },
  );
  const before = {
    list: store.getQuery(api.issues.listBySpace, { spaceId: id<"spaces">("sp") }),
    mine: store.getQuery(api.issues.listMine, {}),
  };
  return { store, list, before };
}

const keys = (issues: ReadonlyArray<{ key: string }> | undefined) => issues?.map((row) => row.key);

describe("optimistic updates", () => {
  it("moves an issue: new status, category, completedAt, top of the column, re-sorted", () => {
    const { store, before } = setUp();
    optimisticMove(store, { issueId: id("i-1"), statusId: id("s-done") }, 500);
    const list = store.getQuery(api.issues.listBySpace, { spaceId: id<"spaces">("sp") })!;
    expect(keys(list)).toEqual(["PAN-2", "PAN-3", "PAN-1"]);
    expect(list[2]).toMatchObject({
      statusId: "s-done",
      statusCategory: "done",
      completedAt: 500,
      updatedAt: 500,
      sortOrder: 1,
    });
    // My issues drops it (done isn't open); the issue page shows the new status.
    expect(keys(store.getQuery(api.issues.listMine, {}))).toEqual(["PAN-3"]);
    expect(store.getQuery(api.issues.get, { key: "PAN-1" })?.issue.statusCategory).toBe("done");
    // The originals were never touched (they're frozen; a write would have thrown).
    expect(before.list?.[0]?.statusCategory).toBe("unstarted");
    expect(keys(before.mine)).toEqual(["PAN-3", "PAN-1"]);
  });

  it("places a drop between neighbours, and reorders without bumping updatedAt", () => {
    const { store } = setUp();
    optimisticMove(
      store,
      { issueId: id("i-2"), statusId: id("s-unstarted"), beforeId: id("i-1") },
      500,
    );
    const list = store.getQuery(api.issues.listBySpace, { spaceId: id<"spaces">("sp") })!;
    expect(keys(list)).toEqual(["PAN-2", "PAN-1", "PAN-3"]);
    expect(list[0]).toMatchObject({ sortOrder: 0, updatedAt: 100 });
    expect(placeInColumn(list, { afterId: id("i-2") }, id("i-3"))).toBe(0.5);
  });

  it("updates priority and assignee everywhere, and keeps My issues in step", () => {
    const { store, before } = setUp();
    optimisticUpdate(store, { issueId: id("i-2"), priority: 1, assigneeId: me._id }, 600);
    const list = store.getQuery(api.issues.listBySpace, { spaceId: id<"spaces">("sp") })!;
    expect(list[1]).toMatchObject({ priority: 1, assigneeId: "m-me", updatedAt: 600 });
    expect(keys(store.getQuery(api.issues.listMine, {}))).toEqual(["PAN-2", "PAN-3", "PAN-1"]);

    optimisticUpdate(store, { issueId: id("i-1"), assigneeId: null, dueDate: "2026-11-30" }, 700);
    const page = store.getQuery(api.issues.get, { key: "PAN-1" })!;
    expect(page.issue.assigneeId).toBeUndefined();
    expect(page.issue.dueDate).toBe("2026-11-30");
    expect(keys(store.getQuery(api.issues.listMine, {}))).toEqual(["PAN-2", "PAN-3"]);
    expect(before.list?.[1]?.priority).toBe(0);
  });

  it("moves an issue and its sub-issues to another project", () => {
    const store = fakeStore();
    const parent = issue(1, "unstarted", 1, { projectId: id<"projects">("p-a") });
    const child = issue(2, "unstarted", 2, {
      projectId: id<"projects">("p-a"),
      parentId: parent._id,
    });
    store.setQuery(
      api.workspace.current,
      {},
      { me, statuses, members: [me], labels: [], spaces: [], projects: [] },
    );
    store.setQuery(api.issues.listBySpace, { spaceId: id<"spaces">("sp") }, [parent, child]);
    store.setQuery(
      api.issues.listBySpace,
      { spaceId: id<"spaces">("sp"), projectId: id<"projects">("p-a") },
      [parent, child],
    );
    optimisticUpdate(store, { issueId: parent._id, projectId: id("p-b") }, 900);
    const all = store.getQuery(api.issues.listBySpace, { spaceId: id<"spaces">("sp") })!;
    expect(all.map((row) => row.projectId)).toEqual(["p-b", "p-b"]);
    // The list narrowed to the old project drops both.
    expect(
      store.getQuery(api.issues.listBySpace, {
        spaceId: id<"spaces">("sp"),
        projectId: id<"projects">("p-a"),
      }),
    ).toEqual([]);
    optimisticUpdate(store, { issueId: parent._id, projectId: null }, 901);
    expect(
      store
        .getQuery(api.issues.listBySpace, { spaceId: id<"spaces">("sp") })!
        .map((row) => row.projectId),
    ).toEqual([undefined, undefined]);
    // A sub-issue can't take its own project: left for the server to refuse.
    optimisticUpdate(store, { issueId: child._id, projectId: id("p-c") }, 902);
    expect(
      store.getQuery(api.issues.listBySpace, { spaceId: id<"spaces">("sp") })![1]!.projectId,
    ).toBeUndefined();
  });

  it("edits the description on the issue page's copy only: list rows don't carry one", () => {
    const store = fakeStore();
    const full = issue(1, "unstarted", 1, { description: "Old" });
    const { description: _description, ...row } = full;
    store.setQuery(
      api.workspace.current,
      {},
      { me, statuses, members: [me], labels: [], spaces: [], projects: [] },
    );
    store.setQuery(api.issues.listBySpace, { spaceId: id<"spaces">("sp") }, [row]);
    store.setQuery(
      api.issues.get,
      { key: "PAN-1" },
      {
        issue: full,
        space: null,
        project: null,
        parent: null,
        subIssues: [],
        comments: [],
        activity: [],
      },
    );
    optimisticUpdate(store, { issueId: full._id, description: "New", title: "Renamed" }, 950);
    expect(store.getQuery(api.issues.get, { key: "PAN-1" })!.issue).toMatchObject({
      description: "New",
      title: "Renamed",
    });
    const listed = store.getQuery(api.issues.listBySpace, { spaceId: id<"spaces">("sp") })![0]!;
    expect(listed).toMatchObject({ title: "Renamed", updatedAt: 950 });
    expect(listed).not.toHaveProperty("description");
  });

  it("adds a comment from me at the end of the thread", () => {
    const { store } = setUp();
    optimisticComment(store, { issueId: id("i-1"), body: "On it" }, 800, "optimistic-1");
    const page = store.getQuery(api.issues.get, { key: "PAN-1" })!;
    expect(page.comments).toEqual([
      {
        _id: "optimistic-1",
        _creationTime: 800,
        issueId: "i-1",
        authorId: "m-me",
        body: "On it",
        via: "app",
      },
    ]);
    expect(page.issue.updatedAt).toBe(800);
  });

  it("does nothing for issues it can't see", () => {
    const { store, before } = setUp();
    optimisticMove(store, { issueId: id("i-99"), statusId: id("s-done") });
    optimisticUpdate(store, { issueId: id("i-99"), priority: 2 });
    expect(store.getQuery(api.issues.listBySpace, { spaceId: id<"spaces">("sp") })).toBe(
      before.list,
    );
  });
});
