import * as React from "react";
import { cn } from "@pantry/ui/lib/utils";

/** An issue key like `PAN-42`: mono, tabular, muted. Fixed width per digit so lists align. */
function IssueKey({ value, className, ...props }: React.ComponentProps<"span"> & { value: string }) {
  return (
    <span
      data-slot="issue-key"
      className={cn("shrink-0 font-mono text-xs tracking-tight text-muted-foreground tabular", className)}
      {...props}
    >
      {value}
    </span>
  );
}

export { IssueKey };
