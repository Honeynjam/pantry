"use client";

import * as React from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useHydrated } from "./use-hydrated";

/**
 * A paragraph whose words light up as you scroll through it (Plane's manifesto block).
 * Scroll position drives opacity only, so it stays on the compositor.
 * Reduced motion: the paragraph is simply shown at full strength.
 */
export function ScrollHighlight({ text, className }: { text: string; className?: string }) {
  const ref = React.useRef<HTMLParagraphElement>(null);
  const hydrated = useHydrated();
  const reduce = useReducedMotion() && hydrated;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = text.split(" ");

  if (reduce) {
    return (
      <p ref={ref} className={className}>
        {text}
      </p>
    );
  }

  return (
    <p ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, index) => (
          <React.Fragment key={index}>
            <Word
              progress={scrollYProgress}
              range={[index / words.length, (index + 1) / words.length]}
            >
              {word}
            </Word>
            {index < words.length - 1 && " "}
          </React.Fragment>
        ))}
      </span>
    </p>
  );
}

function Word({
  children,
  progress,
  range,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  return <motion.span style={{ opacity }}>{children}</motion.span>;
}
