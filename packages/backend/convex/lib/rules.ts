import type { Doc } from "../_generated/dataModel";

/**
 * Pure issue rules that the app's optimistic updates must apply exactly as the server does. No
 * Convex runtime imports, so packages/app can import them (`@pantry/backend/rules`).
 */

export type StatusCategory = Doc<"statuses">["category"];

/** Done and canceled: the categories that set `completedAt`. */
export const isTerminal = (category: StatusCategory) =>
  category === "done" || category === "canceled";

/** "Open" for My issues: Todo, In Progress, In Review (backlog and closed issues aren't). */
export const OPEN_CATEGORIES = [
  "unstarted",
  "started",
  "review",
] as const satisfies readonly StatusCategory[];
export const isOpen = (category: StatusCategory) =>
  (OPEN_CATEGORIES as readonly StatusCategory[]).includes(category);

/** A title as it's stored: trimmed, inner runs of whitespace collapsed to one space. */
export const normalizeTitle = (title: string) => title.trim().replace(/\s+/g, " ");
