"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { LabelChip } from "@pantry/ui/components/label-chip";
import { PriorityGlyph } from "@pantry/ui/components/priority-glyph";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import { spring, tween, useMotionTransition } from "@pantry/ui/lib/motion";
import type { StatusCategory } from "@pantry/ui/lib/issue-meta";
import { cn } from "@pantry/ui/lib/utils";
import { issueKey } from "@/lib/content";
import { useSequence } from "@/components/motion/use-sequence";
import { AppWindow, Mockup } from "./app-window";
import { AGENT_ISSUE, MockAvatar, people, STATUS_NAME, ViaMcp } from "./mock-data";

const KEY = issueKey(AGENT_ISSUE);

type Line =
  | { kind: "prompt"; text: string }
  | { kind: "tool"; name: string; args: string; result: string }
  | { kind: "note"; text: string };

/** The agent's transcript; line i appears at step i + 1. */
const LINES: Line[] = [
  { kind: "prompt", text: `work on ${KEY}` },
  {
    kind: "tool",
    name: "get_space_context",
    args: `"PAN"`,
    result: "1.4 KB · stack, conventions",
  },
  { kind: "tool", name: "get_issue", args: `"${KEY}"`, result: "2 sub-issues, 3 comments" },
  { kind: "tool", name: "update_issue", args: `"${KEY}", status: "In Progress"`, result: "ok" },
  { kind: "note", text: "Edited command-palette/rank.ts and added 6 tests. All passing." },
  { kind: "tool", name: "add_comment", args: `"${KEY}"`, result: "posted" },
  { kind: "tool", name: "update_issue", args: `"${KEY}", status: "In Review"`, result: "ok" },
];
const DURATIONS = [900, 1100, 1000, 1100, 1600, 1300, 1300, 4000];

/** Which line of the transcript drives each change on the issue side. */
const STATUS_AT: { from: number; status: StatusCategory }[] = [
  { from: 0, status: "unstarted" },
  { from: 4, status: "started" },
  { from: 7, status: "review" },
];
const COMMENT_AT = 6;

export function AgentMockup() {
  const ref = React.useRef<HTMLDivElement>(null);
  const step = useSequence(ref, DURATIONS, { loop: false });
  const status = [...STATUS_AT].reverse().find((entry) => step >= entry.from)!.status;
  const appear = useMotionTransition(tween.panelEnter);
  const morph = useMotionTransition(spring.morph);

  return (
    <div ref={ref}>
      <Mockup
        label={`An agent session next to ${KEY}: the agent reads the space's context doc and the issue over MCP, moves it to In Progress, comments, and moves it to In Review.`}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_1.05fr]">
          {/* Terminal */}
          <AppWindow
            title="~/pantry · agent"
            bodyClassName="h-[400px] bg-gray-1 p-4 font-mono text-xs leading-5"
          >
            <div className="space-y-2.5">
              {LINES.map((line, index) =>
                step > index ? (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={appear}
                  >
                    <TerminalLine line={line} />
                  </motion.div>
                ) : null,
              )}
              {step <= LINES.length && step < DURATIONS.length - 1 && (
                <span className="bg-gray-11 inline-block h-4 w-2 animate-pulse align-middle motion-reduce:animate-none" />
              )}
            </div>
          </AppWindow>

          {/* Issue */}
          <AppWindow bodyClassName="h-[400px] bg-gray-1">
            <div className="flex h-full flex-col">
              <div className="border-border text-muted-foreground flex items-center gap-2 border-b px-5 py-3 text-xs">
                <span>Pantry</span>
                <span>/</span>
                <span className="font-mono">{KEY}</span>
              </div>
              <div className="flex-1 space-y-4 overflow-hidden px-5 py-4">
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  Command palette: rank exact key matches first
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <motion.span
                    layout
                    transition={morph}
                    className="border-border bg-gray-2 inline-flex h-6 items-center gap-1.5 rounded-md border px-2"
                  >
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={status}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={morph}
                        className="inline-flex items-center gap-1.5"
                      >
                        <StatusGlyph category={status} size={12} />
                        {STATUS_NAME[status]}
                      </motion.span>
                    </AnimatePresence>
                  </motion.span>
                  <span className="border-border bg-gray-2 inline-flex h-6 items-center gap-1.5 rounded-md border px-2">
                    <PriorityGlyph priority={2} size={12} />
                    High
                  </span>
                  <LabelChip name="Feature" color="blue" />
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <MockAvatar person={people.ana} size="xs" />
                    {people.ana.name}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm leading-6">
                  Typing{" "}
                  <code className="bg-gray-3 text-foreground rounded-xs px-1 font-mono text-xs">
                    pan-42
                  </code>{" "}
                  should put that issue first, ahead of fuzzy title matches.
                </p>

                <div className="border-border space-y-2 border-t pt-4">
                  <div className="text-muted-foreground text-xs font-medium">Activity</div>
                  <ActivityRow visible text={<>Tom Lee created the issue</>} time="2d" />
                  <ActivityRow
                    visible={step >= 4}
                    mcp
                    text={
                      <>
                        Ana Ruiz moved to <StatusInline status="started" />
                      </>
                    }
                  />
                  <AnimatePresence>
                    {step >= COMMENT_AT && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={appear}
                        className="border-border bg-gray-2 rounded-lg border p-3"
                      >
                        <div className="mb-1.5 flex items-center gap-2 text-xs">
                          <MockAvatar person={people.ana} size="xs" />
                          <span className="font-medium">{people.ana.name}</span>
                          <ViaMcp />
                          <span className="text-muted-foreground">just now</span>
                        </div>
                        <p className="text-foreground text-sm leading-6">
                          Exact key matches now rank first, then label prefixes. Added 6 tests in{" "}
                          <code className="font-mono text-xs">rank.test.ts</code>.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <ActivityRow
                    visible={step >= 7}
                    mcp
                    text={
                      <>
                        Ana Ruiz moved to <StatusInline status="review" />
                      </>
                    }
                  />
                </div>
              </div>
            </div>
          </AppWindow>
        </div>
      </Mockup>
    </div>
  );
}

function TerminalLine({ line }: { line: Line }) {
  if (line.kind === "prompt") {
    return (
      <div className="text-foreground">
        <span className="text-muted-foreground">&gt; </span>
        {line.text}
      </div>
    );
  }
  if (line.kind === "note") {
    return <div className="text-muted-foreground pl-4">{line.text}</div>;
  }
  return (
    <div>
      <div className="flex items-start gap-2">
        <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[var(--status-done)]" />
        <span className="text-foreground">
          pantry.<span className="text-[var(--label-teal)]">{line.name}</span>
          <span className="text-muted-foreground">({line.args})</span>
        </span>
      </div>
      <div className="text-muted-foreground flex items-center gap-1.5 pl-4">
        <span className="text-faint-foreground">└</span>
        <Check className="size-3 text-[var(--status-done)]" />
        {line.result}
      </div>
    </div>
  );
}

function StatusInline({ status }: { status: StatusCategory }) {
  return (
    <span className="text-foreground inline-flex items-center gap-1">
      <StatusGlyph category={status} size={12} />
      {STATUS_NAME[status]}
    </span>
  );
}

function ActivityRow({
  visible,
  text,
  time = "just now",
  mcp,
}: {
  visible: boolean;
  text: React.ReactNode;
  time?: string;
  mcp?: boolean;
}) {
  const appear = useMotionTransition(tween.panelEnter);
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={appear}
          className={cn("text-muted-foreground flex items-center gap-2 text-xs")}
        >
          <span className="bg-gray-8 size-1.5 rounded-full" />
          <span>{text}</span>
          {mcp && <ViaMcp />}
          <span className="ml-auto">{time}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
