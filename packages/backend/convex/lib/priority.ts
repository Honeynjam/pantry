import type { Doc } from "../_generated/dataModel";

/**
 * Priority names for MCP, indexed by the stored value: 0 none, 1 urgent, 2 high, 3 medium, 4 low
 * (Linear's order). Agents read and write the names; the app shows its own labels.
 */
export const PRIORITY_NAMES = ["none", "urgent", "high", "medium", "low"] as const;
export type PriorityName = (typeof PRIORITY_NAMES)[number];

export const priorityName = (priority: Doc<"issues">["priority"]): PriorityName => PRIORITY_NAMES[priority];
