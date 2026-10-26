"use client";

import * as React from "react";
import { useInView, useReducedMotion } from "motion/react";
import { useHydrated } from "./use-hydrated";

/**
 * Steps through a mockup's "live" moments on a timer, only while it is on screen.
 * `durations[i]` is how long step i holds before the next; after the last step it loops to 0.
 * Reduced motion: no loop; the mockup shows `restingStep` (its most telling frame) and stays there.
 */
export function useSequence(
  ref: React.RefObject<Element | null>,
  durations: readonly number[],
  {
    restingStep = durations.length - 1,
    loop = true,
  }: { restingStep?: number; loop?: boolean } = {},
) {
  const hydrated = useHydrated();
  const reduce = useReducedMotion() && hydrated;
  const inView = useInView(ref, { amount: 0.4 });
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    if (reduce || !inView) return;
    const last = step === durations.length - 1;
    if (last && !loop) return;
    const timer = window.setTimeout(() => setStep(last ? 0 : step + 1), durations[step]);
    return () => window.clearTimeout(timer);
  }, [step, inView, reduce, durations, loop]);

  return reduce ? restingStep : step;
}
