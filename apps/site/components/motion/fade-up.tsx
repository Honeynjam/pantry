"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { reveal, reducedTransition } from "@pantry/ui/lib/motion";

/**
 * A block fades up once as it scrolls into view (or on mount). `index` staggers siblings.
 * Reduced motion: a short fade in place (only the transition changes, so SSR markup matches).
 */
export function FadeUp({
  children,
  index = 0,
  delay = 0,
  trigger = "view",
  as = "div",
  className,
}: {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  trigger?: "mount" | "view";
  as?: "div" | "li";
  className?: string;
}) {
  const Component = as === "li" ? motion.li : motion.div;
  const reduce = useReducedMotion();
  const { duration, ease, stagger, distance } = reveal.block;
  const visible = { opacity: 1, y: 0 };
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: distance }}
      {...(trigger === "mount" ? { animate: visible } : { whileInView: visible })}
      viewport={{ once: true, amount: 0.3 }}
      transition={
        reduce
          ? { opacity: { ...reducedTransition, delay }, y: { duration: 0 } }
          : { duration, ease, delay: delay + index * stagger }
      }
    >
      {children}
    </Component>
  );
}
