import * as React from "react";
import { cn } from "@pantry/ui/lib/utils";
import { STATUS_CATEGORY_LABEL, type StatusCategory } from "@pantry/ui/lib/issue-meta";

/**
 * Status icon by category: dashed ring (backlog), ring (todo), half pie (in progress),
 * three-quarter pie (in review), filled check (done), filled cross (canceled).
 * The shape carries the meaning, so it reads without colour; `color` overrides the category token
 * (statuses are recolourable).
 */
function StatusGlyph({
  category,
  color,
  size = 14,
  className,
  title,
  ...props
}: Omit<React.ComponentProps<"svg">, "color"> & {
  category: StatusCategory;
  color?: string;
  size?: number;
  title?: string;
}) {
  const stroke = color ?? `var(--status-${category})`;
  const label = title ?? STATUS_CATEGORY_LABEL[category];
  return (
    <svg
      data-slot="status-glyph"
      data-category={category}
      viewBox="0 0 14 14"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={cn("shrink-0", className)}
      style={{ color: stroke }}
      {...props}
    >
      <title>{label}</title>
      {category === "backlog" && (
        <circle
          cx="7"
          cy="7"
          r="5.75"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="1.6 1.41"
          strokeLinecap="butt"
        />
      )}
      {(category === "unstarted" || category === "started" || category === "review") && (
        <circle cx="7" cy="7" r="5.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      )}
      {category === "started" && <path d="M7 7 L7 3.5 A3.5 3.5 0 0 1 7 10.5 Z" fill="currentColor" />}
      {category === "review" && <path d="M7 7 L7 3.5 A3.5 3.5 0 1 1 3.5 7 Z" fill="currentColor" />}
      {(category === "done" || category === "canceled") && <circle cx="7" cy="7" r="6.5" fill="currentColor" />}
      {category === "done" && (
        <path
          d="M4.4 7.2 L6.2 9 L9.7 5.3"
          fill="none"
          stroke="var(--background)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {category === "canceled" && (
        <path
          d="M5 5 L9 9 M9 5 L5 9"
          fill="none"
          stroke="var(--background)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export { StatusGlyph };
