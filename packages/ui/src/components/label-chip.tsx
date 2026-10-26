import * as React from "react";
import { cn } from "@pantry/ui/lib/utils";
import { resolveLabelColor } from "@pantry/ui/lib/issue-meta";

/**
 * A label: hairline pill with a colour dot. The colour stays in the dot so a row of labels
 * doesn't turn into confetti.
 */
function LabelChip({
  name,
  color,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { name: string; color: string }) {
  return (
    <span
      data-slot="label-chip"
      className={cn(
        "inline-flex h-5 max-w-40 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background pr-2 pl-1.5 text-xs text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: resolveLabelColor(color) }}
      />
      <span className="truncate">{name}</span>
      {children}
    </span>
  );
}

export { LabelChip };
