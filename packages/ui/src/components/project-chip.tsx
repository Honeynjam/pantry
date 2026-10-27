import * as React from "react";
import { cn } from "@pantry/ui/lib/utils";
import { resolveLabelColor } from "@pantry/ui/lib/issue-meta";

/**
 * An issue's project (a workstream inside its space): a small square-cornered tag with a square dot,
 * so it reads apart from the round label pills next to it. Uncoloured projects get a neutral dot.
 */
function ProjectChip({
  name,
  color,
  className,
  ...props
}: React.ComponentProps<"span"> & { name: string; color?: string }) {
  return (
    <span
      data-slot="project-chip"
      className={cn(
        "bg-gray-3 text-muted-foreground inline-flex h-5 max-w-36 shrink-0 items-center gap-1.5 rounded-sm px-1.5 text-xs",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color ? resolveLabelColor(color) : "var(--gray-8)" }}
      />
      <span className="truncate">{name}</span>
    </span>
  );
}

export { ProjectChip };
