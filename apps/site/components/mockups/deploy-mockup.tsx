"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, LoaderCircle } from "lucide-react";
import { tween, useMotionTransition } from "@pantry/ui/lib/motion";
import { cn } from "@pantry/ui/lib/utils";
import { brandName } from "@/lib/content";
import { useSequence } from "@/components/motion/use-sequence";
import { AppWindow, Mockup } from "./app-window";

/** The real build, in order (scripts/vercel-build.sh). */
const LOG = [
  { text: "Clone honeynjam/pantry into your GitHub", time: "4s" },
  { text: "Connect Convex (Vercel Marketplace)", time: "12s" },
  { text: "Generate BETTER_AUTH_SECRET", time: "1s" },
  { text: "Deploy Convex functions and schema", time: "38s" },
  { text: "Build the web app", time: "51s" },
];
const STEPS = [700, 900, 1100, 700, 1500, 1500, 4000];

export function DeployMockup() {
  const ref = React.useRef<HTMLDivElement>(null);
  const step = useSequence(ref, STEPS, { loop: false });
  const appear = useMotionTransition(tween.panelEnter);
  const ready = step > LOG.length;

  return (
    <div ref={ref}>
      <Mockup
        label={`Deploy log: clone, connect Convex, generate the auth secret, deploy functions, build. Then ${brandName} is live at your own URL.`}
      >
        <AppWindow
          title="vercel.com · deploy"
          bodyClassName="bg-gray-1 p-5 font-mono text-xs leading-5"
        >
          <ol className="space-y-2.5">
            {LOG.map((line, index) => {
              const done = step > index + 1 || ready;
              const running = step === index + 1;
              return (
                <li
                  key={line.text}
                  className={cn(
                    "flex items-center gap-3",
                    !done && !running && "text-faint-foreground",
                  )}
                >
                  <span className="flex size-4 items-center justify-center">
                    {done ? (
                      <Check className="size-3.5 text-[var(--status-done)]" />
                    ) : running ? (
                      <LoaderCircle className="text-muted-foreground size-3.5 animate-spin motion-reduce:animate-none" />
                    ) : (
                      <span className="bg-gray-7 size-1.5 rounded-full" />
                    )}
                  </span>
                  <span className={cn("flex-1", done && "text-foreground")}>{line.text}</span>
                  <span className="text-muted-foreground tabular">{done ? line.time : ""}</span>
                </li>
              );
            })}
          </ol>
          <div className="mt-5 h-[52px]">
            <AnimatePresence>
              {ready && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={appear}
                  className="border-border bg-gray-2 flex items-center gap-3 rounded-lg border px-3.5 py-2.5"
                >
                  <span className="size-2 rounded-full bg-[var(--status-done)]" />
                  <span className="text-foreground">Ready</span>
                  <span className="text-muted-foreground truncate">
                    https://pantry-ana.vercel.app
                  </span>
                  <span className="text-muted-foreground ml-auto max-sm:hidden">1m 46s</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </AppWindow>
      </Mockup>
    </div>
  );
}
