"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Battery, Wifi } from "lucide-react";
import { PriorityGlyph } from "@pantry/ui/components/priority-glyph";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import { tween, useMotionTransition } from "@pantry/ui/lib/motion";
import { brandName, issueKey } from "@/lib/content";
import { useSequence } from "@/components/motion/use-sequence";
import { Mockup } from "./app-window";
import { PantryAppIcon, PantryMark } from "../pantry-logo";

const TITLE = "Safari loses board order after a drag";
/** Panel opens, the title types itself, then a notification slides in. */
const TYPED_STEPS = 16;
const STEPS = [900, ...Array.from({ length: TYPED_STEPS }, () => 70), 1400, 3200];

export function MacMockup() {
  const ref = React.useRef<HTMLDivElement>(null);
  const step = useSequence(ref, STEPS, { loop: false });
  const appear = useMotionTransition(tween.panelEnter);
  const typedSteps = Math.min(Math.max(step, 0), TYPED_STEPS);
  const typed = TITLE.slice(0, Math.round((typedSteps / TYPED_STEPS) * TITLE.length));
  const notify = step >= STEPS.length - 1;

  return (
    <div ref={ref}>
      <Mockup
        label={`The ${brandName} Mac app's quick-add panel over the desktop, opened with a global shortcut, plus a notification that an agent moved an issue to In Review.`}
      >
        <div className="grain border-border relative overflow-hidden rounded-2xl border bg-[radial-gradient(120%_90%_at_30%_0%,var(--gray-5),var(--gray-2)_55%,var(--gray-1))]">
          {/* Menu bar */}
          <div className="text-gray-11 relative flex h-7 items-center gap-4 bg-[oklch(0_0_0/0.35)] px-4 text-xs backdrop-blur">
            <span className="text-foreground font-medium">Finder</span>
            <span className="max-sm:hidden">File</span>
            <span className="max-sm:hidden">Edit</span>
            <span className="max-sm:hidden">View</span>
            <div className="ml-auto flex items-center gap-3">
              <span className="flex items-center rounded-sm bg-[oklch(1_0_0/0.14)] px-1 py-0.5">
                <PantryMark className="text-foreground size-3.5" />
              </span>
              <Wifi className="size-3.5" />
              <Battery className="size-4" />
              <span className="tabular">Mon 9:41</span>
            </div>
          </div>

          <div className="relative h-[420px] max-sm:h-[360px]">
            {/* Notification */}
            <AnimatePresence>
              {notify && (
                <motion.div
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={appear}
                  className="border-border absolute top-3 right-3 flex w-72 items-start gap-2.5 rounded-2xl border bg-[oklch(0.25_0_0/0.8)] p-3 text-xs backdrop-blur-xl max-sm:hidden"
                >
                  <PantryAppIcon className="size-7" />
                  <div className="min-w-0">
                    <div className="text-foreground flex justify-between font-medium">
                      {brandName}
                      <span className="text-muted-foreground font-normal">now</span>
                    </div>
                    <p className="text-muted-foreground">
                      Ana Ruiz moved <span className="font-mono">{issueKey(42)}</span> to In Review
                      (via MCP)
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dock */}
            <div className="absolute inset-x-0 bottom-3 mx-auto flex w-fit items-end gap-2 rounded-2xl border border-[oklch(1_0_0/0.08)] bg-[oklch(1_0_0/0.06)] p-1.5 backdrop-blur-xl">
              {["var(--gray-7)", "var(--gray-6)", "var(--gray-8)", "var(--gray-6)"].map(
                (color, index) => (
                  <span
                    key={index}
                    className="size-9 rounded-[10px]"
                    style={{ backgroundColor: color }}
                  />
                ),
              )}
              <span className="relative">
                <PantryAppIcon className="size-9 rounded-[10px]" />
                <span className="bg-gray-11 absolute -bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full" />
              </span>
            </div>

            {/* Quick-add panel */}
            <div className="shadow-overlay absolute inset-x-0 top-[44%] mx-auto w-[min(520px,calc(100%-2rem))] -translate-y-1/2 overflow-hidden rounded-xl bg-[oklch(0.22_0_0/0.86)] backdrop-blur-2xl">
              <div className="border-border text-muted-foreground flex items-center gap-2 border-b px-4 pt-3 pb-2 text-xs">
                <span className="size-2 rounded-full bg-[var(--label-green)]" />
                {brandName}
                <span className="text-faint-foreground">›</span>
                New issue
              </div>
              <div className="px-4 pt-3 pb-2 text-lg">
                <span className="text-foreground">{typed}</span>
                <span className="bg-foreground ml-px inline-block h-5 w-px translate-y-1 animate-pulse motion-reduce:animate-none" />
                {!typed && <span className="text-faint-foreground">Issue title</span>}
              </div>
              <div className="text-faint-foreground px-4 pb-3 text-sm">Add a description…</div>
              <div className="border-border flex items-center gap-2 border-t px-4 py-2.5 text-xs">
                <Chip>
                  <StatusGlyph category="unstarted" size={12} />
                  Todo
                </Chip>
                <Chip>
                  <PriorityGlyph priority={2} size={12} />
                  High
                </Chip>
                <span className="bg-primary text-primary-foreground ml-auto inline-flex h-6 items-center gap-1.5 rounded-md px-2 font-medium">
                  Create
                  <span className="text-2xs font-mono opacity-70">⌘↵</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </Mockup>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border text-muted-foreground inline-flex h-6 items-center gap-1.5 rounded-md border px-2">
      {children}
    </span>
  );
}
