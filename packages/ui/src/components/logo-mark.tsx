import * as React from "react";
import { cn } from "@pantry/ui/lib/utils";

/** Monochrome square mark with an initial (product or workspace). Inverts with the theme. */
function LogoMark({
  name,
  size = "default",
  className,
}: {
  name: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      data-slot="logo-mark"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-primary font-display font-semibold text-primary-foreground select-none",
        size === "sm" && "size-5 rounded-sm text-[0.625rem]",
        size === "default" && "size-6 text-xs",
        size === "lg" && "size-9 rounded-lg text-base",
        className,
      )}
    >
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

export { LogoMark };
