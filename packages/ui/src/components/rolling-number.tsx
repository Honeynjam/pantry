"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@pantry/ui/lib/utils";
import { spring, usePrefersReducedMotion } from "@pantry/ui/lib/motion";

/**
 * A count that rolls when it changes (the sidebar's My issues count): the old number slides out
 * and the new one in, upwards when it grows and downwards when it shrinks, on the snappy spring.
 * Reduced motion: the number just changes.
 */
function RollingNumber({ value, className }: { value: number; className?: string }) {
  const reduce = usePrefersReducedMotion();
  const [state, setState] = React.useState({ value, direction: 1 });
  if (state.value !== value) setState({ value, direction: value > state.value ? 1 : -1 });
  const travel = reduce ? 0 : state.direction;

  return (
    <span data-slot="rolling-number" className={cn("relative inline-flex overflow-hidden tabular-nums", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: `${travel * 100}%`, opacity: reduce ? 1 : 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: `${travel * -100}%`, opacity: reduce ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : spring.snappy}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export { RollingNumber };
