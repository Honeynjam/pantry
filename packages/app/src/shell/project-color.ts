import { LABEL_COLORS, labelColorVar } from "@pantry/ui/lib/issue-meta";

/**
 * Projects have no colour field yet (schema §10b), so the sidebar dot is derived from the key:
 * stable per project, drawn from the curated label palette (grey excluded).
 */
export function projectColor(key: string): string {
  const palette = LABEL_COLORS.filter((color) => color !== "gray");
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return labelColorVar(palette[hash % palette.length]!);
}
