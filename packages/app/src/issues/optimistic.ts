import { api } from "@pantry/backend/api";
import type { Doc, Id } from "@pantry/backend/dataModel";
import { isOpen, isTerminal, normalizeTitle } from "@pantry/backend/rules";
import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionArgs } from "convex/server";
import type { ListIssue } from "./lookups";

/**
 * Optimistic updates (spec §10b M3 task 4): the cached `issues.listByProject`, `issues.listMine`,
 * `issues.get` and `issues.search` results change the moment a write is sent, and Convex rolls
 * them back when the server answers (with its own data, or an error).
 *
 * Query results are shared, frozen-in-spirit client state: every change here builds new arrays
 * and objects and never touches what `getQuery` returned.
 *
 * Lists carry issues without their description (`ListIssue`); only `issues.get`'s issue has one.
 * The builders are generic over both, so each cached copy keeps its own shape.
 */

type Issue = ListIssue;
type MoveArgs = FunctionArgs<typeof api.issues.move>;
type UpdateArgs = FunctionArgs<typeof api.issues.update>;
type CommentArgs = FunctionArgs<typeof api.comments.add>;


/** Statuses in workspace order, and who "me" is, from the shell's cached workspace query. */
function workspace(store: OptimisticLocalStore) {
  return store.getQuery(api.workspace.current, {});
}

/** The freshest cached copy of an issue, from whichever query has it. */
function findIssue(store: OptimisticLocalStore, issueId: Id<"issues">): Issue | undefined {
  for (const { value } of store.getAllQueries(api.issues.listBySpace)) {
    const hit = value?.find((issue) => issue._id === issueId);
    if (hit) return hit;
  }
  for (const { value } of store.getAllQueries(api.issues.get)) {
    if (value?.issue._id === issueId) return value.issue;
    const sub = value?.subIssues.find((issue) => issue._id === issueId);
    if (sub) return sub;
  }
  return store.getQuery(api.issues.listMine, {})?.find((issue) => issue._id === issueId);
}

/** Status order then `sortOrder`, the order `listByProject` returns. */
function sortByStatus(issues: Issue[], statusOrder: Map<Id<"statuses">, number>): Issue[] {
  return [...issues].sort(
    (a, b) =>
      (statusOrder.get(a.statusId) ?? 0) - (statusOrder.get(b.statusId) ?? 0) || a.sortOrder - b.sortOrder,
  );
}

/**
 * Where `issues.move` will put the issue in its new column: the top (`min - 1`), right after
 * `afterId` or right before `beforeId`, the midpoint between neighbours (the server's rule; it
 * may renumber a crowded column, which then arrives with its answer).
 */
export function placeInColumn(column: ReadonlyArray<Issue>, args: Pick<MoveArgs, "afterId" | "beforeId">, issueId: Id<"issues">) {
  const others = column.filter((issue) => issue._id !== issueId).sort((a, b) => a.sortOrder - b.sortOrder);
  let index = -1;
  if (args.afterId) {
    const at = others.findIndex((issue) => issue._id === args.afterId);
    if (at >= 0) index = at + 1;
  }
  if (index < 0 && args.beforeId) index = others.findIndex((issue) => issue._id === args.beforeId);
  if (index < 0) index = 0;
  const above = others[index - 1];
  const below = others[index];
  if (!above && !below) return 1;
  if (!above) return below!.sortOrder - 1;
  if (!below) return above.sortOrder + 1;
  return (above.sortOrder + below.sortOrder) / 2;
}

/** Replace one issue in every cached query that shows it. `next` builds the new copy. */
function replaceEverywhere(store: OptimisticLocalStore, issueId: Id<"issues">, next: <T extends Issue>(issue: T) => T) {
  for (const { args, value } of store.getAllQueries(api.issues.get)) {
    if (!value) continue;
    const isIt = value.issue._id === issueId;
    const inSubs = value.subIssues.some((issue) => issue._id === issueId);
    const isParent = value.parent?._id === issueId;
    if (!isIt && !inSubs && !isParent) continue;
    const parent = isParent && value.parent ? next({ ...findIssue(store, issueId), ...value.parent } as Issue) : null;
    store.setQuery(api.issues.get, args, {
      ...value,
      issue: isIt ? next(value.issue) : value.issue,
      subIssues: inSubs ? value.subIssues.map((issue) => (issue._id === issueId ? next(issue) : issue)) : value.subIssues,
      parent:
        isParent && value.parent && parent
          ? { ...value.parent, title: parent.title, statusId: parent.statusId }
          : value.parent,
    });
  }
  for (const { args, value } of store.getAllQueries(api.issues.search)) {
    if (!value?.some((hit) => hit._id === issueId)) continue;
    store.setQuery(
      api.issues.search,
      args,
      value.map((hit) => {
        if (hit._id !== issueId) return hit;
        const issue = next({ ...findIssue(store, issueId), ...hit } as Issue);
        return { ...hit, title: issue.title, statusId: issue.statusId, priority: issue.priority, assigneeId: issue.assigneeId };
      }),
    );
  }
}

/** Keep My issues in step: an open issue assigned to me is listed, anything else isn't. */
function syncMine(store: OptimisticLocalStore, issue: Issue) {
  const mine = store.getQuery(api.issues.listMine, {});
  const me = workspace(store)?.me._id;
  if (!mine || !me) return;
  const belongs = issue.assigneeId === me && isOpen(issue.statusCategory);
  const others = mine.filter((row) => row._id !== issue._id);
  const next = belongs ? [...others, issue].sort((a, b) => b.updatedAt - a.updatedAt) : others;
  if (next.length === mine.length && next.every((row, index) => row === mine[index])) return;
  store.setQuery(api.issues.listMine, {}, next);
}

/** `issues.move`: new status, category, `completedAt` and place; the lists re-sort around it. */
export function optimisticMove(store: OptimisticLocalStore, args: MoveArgs, now = Date.now()) {
  const current = findIssue(store, args.issueId);
  const data = workspace(store);
  const status = data?.statuses.find((row) => row._id === args.statusId);
  if (!current || !data || !status) return;
  const statusOrder = new Map(data.statuses.map((row, index) => [row._id, index]));
  const changed = current.statusId !== status._id;
  const previous = data.statuses.find((row) => row._id === current.statusId);

  const build = (issue: Issue, column: ReadonlyArray<Issue>): Issue => {
    const sortOrder = placeInColumn(column, args, issue._id);
    if (!changed) return { ...issue, sortOrder };
    const completedAt = isTerminal(status.category)
      ? previous && isTerminal(previous.category) && issue.completedAt !== undefined
        ? issue.completedAt
        : now
      : undefined;
    return { ...issue, statusId: status._id, statusCategory: status.category, completedAt, sortOrder, updatedAt: now };
  };

  let moved: Issue | undefined;
  for (const { args: queryArgs, value } of store.getAllQueries(api.issues.listBySpace)) {
    if (!value?.some((issue) => issue._id === args.issueId)) continue;
    const column = value.filter((issue) => issue.statusId === status._id);
    const updated = build(value.find((issue) => issue._id === args.issueId)!, column);
    moved = updated;
    store.setQuery(
      api.issues.listBySpace,
      queryArgs,
      sortByStatus(value.map((issue) => (issue._id === args.issueId ? updated : issue)), statusOrder),
    );
  }
  const result = moved ?? build(current, []);
  replaceEverywhere(store, args.issueId, <T extends Issue>(issue: T): T => ({
    ...issue,
    statusId: result.statusId,
    statusCategory: result.statusCategory,
    completedAt: result.completedAt,
    sortOrder: result.sortOrder,
    updatedAt: result.updatedAt,
  }));
  syncMine(store, result);
}

/**
 * `issues.update`: title, priority, assignee, labels, due date and project show at once. A project
 * change also moves the issue's sub-issues, as the server does. A sub-issue's own project change is
 * refused by the server, so it's left alone here.
 */
export function optimisticUpdate(store: OptimisticLocalStore, args: UpdateArgs, now = Date.now()) {
  const current = findIssue(store, args.issueId);
  if (!current) return;
  const setsProject = args.projectId !== undefined && !current.parentId;
  const withProject = <T extends Issue>(issue: T): T => {
    const next: T = { ...issue, updatedAt: now };
    if (args.projectId === null) delete next.projectId;
    else if (args.projectId !== undefined) next.projectId = args.projectId;
    return next;
  };
  const apply = <T extends Issue>(issue: T): T => {
    const next: T = setsProject ? withProject(issue) : { ...issue, updatedAt: now };
    if (args.title !== undefined) next.title = normalizeTitle(args.title);
    if (args.priority !== undefined) next.priority = args.priority;
    if (args.labelIds !== undefined) next.labelIds = [...args.labelIds];
    if (args.assigneeId !== undefined) {
      if (args.assigneeId === null) delete next.assigneeId;
      else next.assigneeId = args.assigneeId;
    }
    if (args.dueDate !== undefined) {
      if (args.dueDate === null) delete next.dueDate;
      else next.dueDate = args.dueDate;
    }
    // Parent changes reshape sub-issue lists and run server checks: they wait for the server.
    // Only the issue page's copy carries the description.
    return args.description !== undefined && "description" in issue ? { ...next, description: args.description } : next;
  };
  const isChild = (issue: Issue) => setsProject && issue.parentId === args.issueId;

  for (const { args: queryArgs, value } of store.getAllQueries(api.issues.listBySpace)) {
    if (!value?.some((issue) => issue._id === args.issueId || isChild(issue))) continue;
    const next = value.map((issue) => (issue._id === args.issueId ? apply(issue) : isChild(issue) ? withProject(issue) : issue));
    // A list narrowed to one project drops what left it.
    const narrowed = queryArgs.projectId ? next.filter((issue) => issue.projectId === queryArgs.projectId) : next;
    store.setQuery(api.issues.listBySpace, queryArgs, narrowed);
  }
  replaceEverywhere(store, args.issueId, apply);
  if (setsProject) {
    for (const { args: queryArgs, value } of store.getAllQueries(api.issues.get)) {
      if (!value || value.issue._id !== args.issueId || value.subIssues.length === 0) continue;
      store.setQuery(api.issues.get, queryArgs, { ...value, subIssues: value.subIssues.map(withProject) });
    }
  }
  syncMine(store, apply(current));
}

/** `comments.add`: the comment appears at the end of the thread, from me, right away. */
export function optimisticComment(
  store: OptimisticLocalStore,
  args: CommentArgs,
  now = Date.now(),
  tempId: string = `optimistic-${now}-${Math.random().toString(36).slice(2)}`,
) {
  const me = workspace(store)?.me;
  if (!me) return;
  for (const { args: queryArgs, value } of store.getAllQueries(api.issues.get)) {
    if (!value || value.issue._id !== args.issueId) continue;
    const comment: Doc<"comments"> = {
      _id: tempId as Id<"comments">,
      _creationTime: now,
      issueId: args.issueId,
      authorId: me._id,
      body: args.body,
      via: "app",
    };
    store.setQuery(api.issues.get, queryArgs, {
      ...value,
      issue: { ...value.issue, updatedAt: now },
      comments: [...value.comments, comment],
    });
  }
}

/** Optimistic comments carry a temporary id until the server's copy replaces them. */
export const isOptimisticId = (id: string) => id.startsWith("optimistic-");
