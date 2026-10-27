"use client";

import * as React from "react";
import { motion } from "motion/react";
import { PlayIcon } from "lucide-react";
import { Button } from "@pantry/ui/components/button";
import { SegmentedControl } from "@pantry/ui/components/segmented-control";
import { duration, spring, usePrefersReducedMotion } from "@pantry/ui/lib/motion";
import { cn } from "@pantry/ui/lib/utils";
import { Section, Specimen, SubSection, TokenName } from "./section";

const SPRINGS = [
  {
    name: "smooth",
    css: "smooth",
    spec: "0.4s · bounce 0",
    use: "panels, heights, drawers, sidebar width",
  },
  {
    name: "snappy",
    css: "snappy",
    spec: "0.26s · bounce 0.15",
    use: "presses, small indicators, icon swaps",
  },
  { name: "morph", css: "morph", spec: "0.42s · bounce 0.15", use: "shared highlights (layoutId)" },
] as const;

const TWEENS = [
  { name: "instant", value: duration.instant, use: "hover colour, menu exits" },
  { name: "fast", value: duration.fast, use: "menu / popover / tooltip enter" },
  { name: "exit", value: duration.exit, use: "dialog exit" },
  { name: "standard", value: duration.standard, use: "dialog enter, backdrop" },
] as const;

/**
 * A dot travelling along a track. The filled dot runs on motion (TS token), the ring runs on the
 * CSS mirror; they should land together. Reduced motion: both jump.
 */
function Track({
  on,
  springName,
  cssDuration,
  cssEase,
}: {
  on: boolean;
  springName?: keyof typeof spring;
  cssDuration: string;
  cssEase: string;
}) {
  const reduce = usePrefersReducedMotion();
  return (
    <div className="bg-muted relative h-6 flex-1 rounded-full">
      <div className="absolute inset-y-0 right-6 left-0">
        {springName && (
          <motion.div
            className="absolute inset-0"
            initial={false}
            animate={{ x: on ? "100%" : "0%" }}
            transition={reduce ? { duration: 0 } : spring[springName]}
          >
            <span className="bg-primary absolute top-1 left-1 size-4 rounded-full" />
          </motion.div>
        )}
        <div
          className={cn(
            "absolute inset-0 transition-transform in-[.reduce-motion]:transition-none motion-reduce:transition-none",
            on ? "translate-x-full" : "translate-x-0",
          )}
          style={{ transitionDuration: cssDuration, transitionTimingFunction: cssEase }}
        >
          <span
            className={cn(
              "absolute top-1 left-1 size-4 rounded-full",
              springName ? "border-foreground/60 border-[1.5px]" : "bg-foreground",
            )}
          />
        </div>
      </div>
    </div>
  );
}

export function MotionSection() {
  const [springsOn, setSpringsOn] = React.useState(false);
  const [tweensOn, setTweensOn] = React.useState(false);
  const [view, setView] = React.useState<"list" | "board" | "timeline">("list");

  return (
    <Section
      id="motion"
      title="Motion"
      description="Quiet and quick. Animate transform and opacity only; one continuous movement per state change; springs for anything you can reverse, so it can be interrupted mid-flight; exits faster than entrances; no scroll reveals or decorative loops. Every animation has a reduced-motion branch that keeps the end state and drops the travel."
    >
      <SubSection title="Springs" hint="src/lib/motion.ts · spring.* ↔ --ease-spring-*">
        <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
          {SPRINGS.map((item) => (
            <div key={item.name} className="flex items-center gap-4">
              <div className="flex w-44 shrink-0 flex-col">
                <TokenName className="text-foreground text-xs">spring.{item.name}</TokenName>
                <span className="text-2xs text-muted-foreground">{item.spec}</span>
              </div>
              <Track
                on={springsOn}
                springName={item.name}
                cssDuration={`var(--spring-${item.css}-duration)`}
                cssEase={`var(--ease-spring-${item.css})`}
              />
              <span className="text-muted-foreground hidden w-52 shrink-0 text-xs lg:block">
                {item.use}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSpringsOn((on) => !on)}
              data-icon="inline-start"
            >
              <PlayIcon />
              Play springs
            </Button>
            <span className="text-muted-foreground text-xs">
              Filled dot: motion spring. Ring: its CSS <code className="font-mono">linear()</code>{" "}
              mirror. They land together.
            </span>
          </div>
        </div>
      </SubSection>

      <SubSection title="Tweens" hint="duration.* ↔ --duration-* with --ease-out">
        <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
          {TWEENS.map((item) => (
            <div key={item.name} className="flex items-center gap-4">
              <div className="flex w-44 shrink-0 flex-col">
                <TokenName className="text-foreground text-xs">duration.{item.name}</TokenName>
                <span className="text-2xs text-muted-foreground tabular font-mono">
                  {item.value * 1000}ms
                </span>
              </div>
              <Track
                on={tweensOn}
                cssDuration={`var(--duration-${item.name})`}
                cssEase="var(--ease-out)"
              />
              <span className="text-muted-foreground hidden w-52 shrink-0 text-xs lg:block">
                {item.use}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setTweensOn((on) => !on)}
              data-icon="inline-start"
            >
              <PlayIcon />
              Play tweens
            </Button>
            <span className="text-muted-foreground text-xs">
              Eases: <code className="font-mono">--ease-out</code> enter,{" "}
              <code className="font-mono">--ease-in</code> exit,{" "}
              <code className="font-mono">--ease-in-out</code> on-screen moves.
            </span>
          </div>
        </div>
      </SubSection>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <SubSection title="Shared highlight" hint="spring.morph via layoutId">
          <Specimen>
            <SegmentedControl
              aria-label="View"
              value={view}
              onValueChange={setView}
              options={[
                { value: "list", label: "List" },
                { value: "board", label: "Board" },
                { value: "timeline", label: "Timeline" },
              ]}
            />
            <span className="text-muted-foreground text-xs">Click, or arrow keys.</span>
          </Specimen>
        </SubSection>
        <SubSection title="Press" hint="--press-scale 0.97 · duration.instant">
          <Specimen>
            <Button>Create issue</Button>
            <Button variant="secondary">Cancel</Button>
            <span className="text-muted-foreground text-xs">Menu triggers don&apos;t scale.</span>
          </Specimen>
        </SubSection>
      </div>
    </Section>
  );
}
