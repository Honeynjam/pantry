/**
 * Shared class strings so every popup, menu row and control moves and focuses the same way.
 * Timing comes only from the motion tokens (CSS variables in globals.css).
 */

/**
 * Popup enter/exit on Base UI's data-starting-style / data-ending-style: CSS transitions, so they
 * are interruptible. Scales from the trigger (--transform-origin). Under reduced motion the
 * scale is dropped and only the fade remains.
 */
export const popupMotion = [
  "origin-(--transform-origin) transition-[opacity,scale,translate]",
  "duration-(--duration-fast) ease-(--ease-out)",
  "data-starting-style:scale-[0.96] data-starting-style:opacity-0",
  "data-ending-style:scale-[0.96] data-ending-style:opacity-0",
  "data-ending-style:duration-(--duration-instant) data-ending-style:ease-(--ease-in)",
  "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
  "in-[.reduce-motion]:data-starting-style:scale-100 in-[.reduce-motion]:data-ending-style:scale-100",
].join(" ");

/** Dialog panel: rises slightly and fades; exits faster than it enters. */
export const dialogMotion = [
  "transition-[opacity,scale,translate] duration-(--duration-standard) ease-(--ease-out)",
  "data-starting-style:translate-y-2 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
  "data-ending-style:translate-y-1 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
  "data-ending-style:duration-(--duration-exit) data-ending-style:ease-(--ease-in)",
  "motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100",
  "motion-reduce:data-ending-style:translate-y-0 motion-reduce:data-ending-style:scale-100",
  "in-[.reduce-motion]:data-starting-style:translate-y-0 in-[.reduce-motion]:data-starting-style:scale-100",
  "in-[.reduce-motion]:data-ending-style:translate-y-0 in-[.reduce-motion]:data-ending-style:scale-100",
].join(" ");

/** Backdrop fade. */
export const backdropMotion =
  "transition-opacity duration-(--duration-standard) ease-(--ease-out) data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-(--duration-exit)";

/** Overlay surface: popover colour, hairline + layered shadow, small radius. */
export const overlaySurface = "bg-popover text-popover-foreground shadow-overlay rounded-lg";

/** A row inside a menu, command list or select. */
export const menuItem = [
  "relative flex h-menu-item cursor-default items-center gap-2 rounded-sm px-2 text-sm outline-none select-none",
  "text-foreground transition-colors duration-(--duration-instant)",
  "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
  "data-disabled:pointer-events-none data-disabled:text-faint-foreground",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 [&_svg:not([class*='text-'])]:text-muted-foreground",
].join(" ");

/** Keyboard-only focus ring for custom controls that set outline-none. */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
