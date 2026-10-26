import * as React from "react";
import { cn } from "@pantry/ui/lib/utils";
import { brandName } from "@/lib/content";

/**
 * Pantry's mark: a jar (the pantry) with a check cut out of it (the done issue).
 * One path with an even-odd hole, so the check shows whatever is behind it on any theme.
 */
export function PantryMark(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <rect x="6.5" y="2" width="11" height="3.5" rx="1.25" />
      <path
        fillRule="evenodd"
        d="M8.5 7h7a4.5 4.5 0 0 1 4.5 4.5v6A4.5 4.5 0 0 1 15.5 22h-7A4.5 4.5 0 0 1 4 17.5v-6A4.5 4.5 0 0 1 8.5 7Zm-.9 7.55 1.4-1.4 2 2 4.2-4.2 1.4 1.4-5.6 5.6-3.4-3.4Z"
      />
    </svg>
  );
}

export function PantryLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display inline-flex items-center gap-2 font-semibold tracking-[-0.02em]",
        className,
      )}
    >
      <PantryMark className="size-[1.15em]" />
      {brandName}
    </span>
  );
}

/** The Mac app icon: the mark on a dark squircle. */
export function PantryAppIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[24%] bg-[linear-gradient(180deg,oklch(0.3_0_0),oklch(0.16_0_0))] text-[oklch(0.96_0_0)] shadow-[inset_0_0_0_1px_oklch(1_0_0/0.12)]",
        className,
      )}
    >
      <PantryMark className="size-[58%]" />
    </span>
  );
}
