/**
 * Display metadata for issue properties. Mirrors the backend's literal unions
 * (packages/backend/convex/schema.ts) without importing it, so packages/ui stays standalone.
 */

export const STATUS_CATEGORIES = [
  "backlog",
  "unstarted",
  "started",
  "review",
  "done",
  "canceled",
] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export const STATUS_CATEGORY_LABEL: Record<StatusCategory, string> = {
  backlog: "Backlog",
  unstarted: "Todo",
  started: "In Progress",
  review: "In Review",
  done: "Done",
  canceled: "Canceled",
};

/** 0 none, 1 urgent, 2 high, 3 medium, 4 low (Linear's order). */
export const PRIORITIES = [0, 1, 2, 3, 4] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL: Record<Priority, string> = {
  0: "No priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

/** Curated label colours (users pick from these). Values are CSS variables from globals.css. */
export const LABEL_COLORS = [
  "gray",
  "red",
  "orange",
  "yellow",
  "lime",
  "green",
  "teal",
  "blue",
  "indigo",
  "violet",
  "pink",
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export const labelColorVar = (color: LabelColor) => `var(--label-${color})`;

/** A label colour is either one of the curated names or any CSS colour (e.g. a stored hex). */
export function resolveLabelColor(color: string): string {
  return (LABEL_COLORS as readonly string[]).includes(color)
    ? labelColorVar(color as LabelColor)
    : color;
}
