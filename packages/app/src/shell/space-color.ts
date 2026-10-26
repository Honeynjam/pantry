import { LABEL_COLORS, labelColorVar, resolveLabelColor } from "@pantry/ui/lib/issue-meta";

/**
 * Spaces have no colour field (schema §10b), so their dot is derived from the key: stable per
 * space, drawn from the curated label palette (grey excluded).
 */
export function spaceColor(key: string): string {
  const palette = LABEL_COLORS.filter((color) => color !== "gray");
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return labelColorVar(palette[hash % palette.length]!);
}

/** A project's dot: its own colour (a palette name), else a neutral grey. */
export function projectColor(project: { color?: string }): string {
  return project.color ? resolveLabelColor(project.color) : "var(--gray-8)";
}
