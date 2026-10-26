import { resolveLabelColor } from "@pantry/ui/lib/issue-meta";

// Spaces show a PantryAvatar (components/space-avatar.tsx); projects keep a colour dot.

/** A project's dot: its own colour (a palette name), else a neutral grey. */
export function projectColor(project: { color?: string }): string {
  return project.color ? resolveLabelColor(project.color) : "var(--gray-8)";
}
