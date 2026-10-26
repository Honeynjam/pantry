"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { reveal, reducedTransition } from "@pantry/ui/lib/motion";

/**
 * Headline words rise out of a blur one after another (Plane-style). Runs once: on mount for the
 * hero (`trigger="mount"`), or the first time the heading scrolls into view.
 * Screen readers get the whole sentence once; the split words are hidden from them.
 * Reduced motion: a short fade; blur and travel snap to their end state. Only the transition
 * changes (never `initial`), so server and client render the same markup.
 */
export function WordReveal({
  text,
  as: Tag = "h2",
  trigger = "view",
  delay = 0,
  className,
}: {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  trigger?: "mount" | "view";
  delay?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, amount: reveal.amount });
  const reduce = useReducedMotion();
  const show = trigger === "mount" || inView;
  const words = text.split(" ");
  const { duration, ease, stagger, blur, distance } = reveal.words;

  return (
    <Tag ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, index) => (
          <React.Fragment key={index}>
            <motion.span
              className="inline-block will-change-[transform,filter,opacity]"
              initial={{ opacity: 0, y: distance, filter: `blur(${blur}px)` }}
              animate={show ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
              transition={
                reduce
                  ? {
                      opacity: { ...reducedTransition, delay },
                      y: { duration: 0 },
                      filter: { duration: 0 },
                    }
                  : { duration, ease, delay: delay + index * stagger }
              }
            >
              {word}
            </motion.span>
            {index < words.length - 1 && " "}
          </React.Fragment>
        ))}
      </span>
    </Tag>
  );
}
