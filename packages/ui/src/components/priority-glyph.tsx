import * as React from "react";
import { cn } from "@pantry/ui/lib/utils";
import { PRIORITY_LABEL, type Priority } from "@pantry/ui/lib/issue-meta";

const BARS = [
  { x: 1.5, height: 4.5 },
  { x: 5.75, height: 7.5 },
  { x: 10, height: 10.5 },
] as const;

/**
 * Priority icon: three bars filled 3/2/1 for high/medium/low, an orange square with "!" for urgent,
 * three dashes for none. Urgent is the only coloured one so it stands out in a list.
 */
function PriorityGlyph({
  priority,
  size = 14,
  className,
  title,
  ...props
}: React.ComponentProps<"svg"> & { priority: Priority; size?: number; title?: string }) {
  const label = title ?? PRIORITY_LABEL[priority];
  const filled = priority === 2 ? 3 : priority === 3 ? 2 : priority === 4 ? 1 : 0;
  return (
    <svg
      data-slot="priority-glyph"
      data-priority={priority}
      viewBox="0 0 14 14"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={cn("shrink-0", className)}
      {...props}
    >
      <title>{label}</title>
      {priority === 0 &&
        BARS.map((bar) => (
          <rect key={bar.x} x={bar.x} y="6.25" width="2.5" height="1.5" rx="0.75" fill="var(--faint-foreground)" />
        ))}
      {priority === 1 && (
        <>
          <rect x="1" y="1" width="12" height="12" rx="3" fill="var(--priority-urgent)" />
          <rect x="6.25" y="3.5" width="1.5" height="4.75" rx="0.75" fill="var(--background)" />
          <circle cx="7" cy="10.15" r="0.9" fill="var(--background)" />
        </>
      )}
      {filled > 0 &&
        BARS.map((bar, index) => (
          <rect
            key={bar.x}
            x={bar.x}
            y={12.5 - bar.height}
            width="2.5"
            height={bar.height}
            rx="0.75"
            fill={index < filled ? "var(--priority-bar)" : "var(--priority-bar-dim)"}
          />
        ))}
    </svg>
  );
}

export { PriorityGlyph };
