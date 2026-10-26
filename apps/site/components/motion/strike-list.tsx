"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { reveal } from "@pantry/ui/lib/motion";

/**
 * Things we left out: each one appears, then a line strikes through it, one after another.
 * Reduced motion: the struck-through list, still.
 */
export function StrikeList({ items }: { items: readonly string[] }) {
  const ref = React.useRef<HTMLUListElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const { duration, ease } = reveal.block;

  return (
    <ul ref={ref} className="grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <li key={item} className="border-border border-t pt-5">
          <span className="font-display text-muted-foreground relative inline-block text-xl font-medium tracking-tight">
            <span className="sr-only">Not included: </span>
            {item}
            <motion.span
              aria-hidden
              className="bg-gray-11 absolute top-1/2 -right-1 -left-1 h-px origin-left"
              initial={{ scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : undefined}
              transition={
                reduce
                  ? { duration: 0 }
                  : { duration: duration * 0.8, ease, delay: 0.3 + index * 0.12 }
              }
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
