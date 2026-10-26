"use client";

import * as React from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { CornerDownLeft, FolderClosed, Search, SquarePen } from "lucide-react";
import { PriorityGlyph } from "@pantry/ui/components/priority-glyph";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import { spring, tween, useMotionTransition } from "@pantry/ui/lib/motion";
import type { StatusCategory } from "@pantry/ui/lib/issue-meta";
import { cn } from "@pantry/ui/lib/utils";
import { issueKey } from "@/lib/content";
import { useSequence } from "@/components/motion/use-sequence";
import { Mockup } from "./app-window";
import { MockAvatar, people, STATUS_NAME, ViaMcp } from "./mock-data";

/* ---------------------------------------------------------------------------------------------
 * Command palette: the query types itself, results narrow, the exact key match ranks first.
 * ------------------------------------------------------------------------------------------- */

const QUERY = "pan-42";
const RESULTS = [
  {
    id: "42",
    icon: "issue",
    title: "Command palette: rank exact key matches first",
    meta: issueKey(42),
    status: "started",
  },
  {
    id: "4",
    icon: "issue",
    title: "Design tokens for light and dark",
    meta: issueKey(4),
    status: "done",
  },
  { id: "p", icon: "project", title: "Open project Pantry", meta: "G then P" },
  { id: "n", icon: "action", title: "New issue in Pantry", meta: "C" },
] as const;

/** One step per typed character (the "4" holds a beat), then it rests. */
const PALETTE_STEPS = [700, 160, 160, 160, 160, 700, 3000];

export function PaletteMockup() {
  const ref = React.useRef<HTMLDivElement>(null);
  const step = useSequence(ref, PALETTE_STEPS, { loop: false });
  const typed = QUERY.slice(0, Math.min(step, QUERY.length));
  // "pan-4" ranks PAN-4 first; the full key "pan-42" jumps PAN-42 to the top.
  const [exact, partial, ...rest] = RESULTS;
  const shown = typed.length < 3 ? rest : typed === QUERY ? RESULTS : [partial, exact, ...rest];
  const morph = useMotionTransition(spring.morph);
  const active = shown[0]!.id;

  return (
    <div ref={ref}>
      <Mockup label="Command palette: typing pan-42 puts that issue first.">
        <div className="bg-popover shadow-overlay mx-auto w-full max-w-md overflow-hidden rounded-xl text-sm">
          <div className="border-border flex h-11 items-center gap-2.5 border-b px-3.5">
            <Search className="text-muted-foreground size-4" />
            <span className="text-foreground font-mono">{typed}</span>
            <span className="bg-foreground -ml-2 h-4 w-px animate-pulse motion-reduce:animate-none" />
            {!typed && <span className="text-faint-foreground">Search or run a command</span>}
          </div>
          <LayoutGroup>
            <div className="p-1.5">
              <AnimatePresence initial={false} mode="popLayout">
                {shown.map((result) => (
                  <motion.div
                    key={result.id}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={morph}
                    className="relative flex h-9 items-center gap-2.5 rounded-md px-2.5"
                  >
                    {active === result.id && (
                      <motion.span
                        layoutId="palette-highlight"
                        transition={morph}
                        className="bg-accent absolute inset-0 rounded-md"
                      />
                    )}
                    <span className="relative flex items-center">
                      {"status" in result ? (
                        <StatusGlyph category={result.status as StatusCategory} />
                      ) : result.icon === "project" ? (
                        <FolderClosed className="text-muted-foreground size-3.5" />
                      ) : (
                        <SquarePen className="text-muted-foreground size-3.5" />
                      )}
                    </span>
                    <span className="relative min-w-0 flex-1 truncate">{result.title}</span>
                    <span className="text-2xs text-muted-foreground relative font-mono">
                      {result.meta}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </LayoutGroup>
          <div className="border-border text-muted-foreground flex items-center justify-end gap-1.5 border-t px-3 py-2 text-xs">
            Open
            <CornerDownLeft className="size-3" />
          </div>
        </div>
      </Mockup>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Board: a card glides across columns.
 * ------------------------------------------------------------------------------------------- */

const COLUMNS: StatusCategory[] = ["unstarted", "started", "review"];
const BOARD = [
  { n: 44, title: "Columns scroll on mobile", priority: 3, column: "unstarted" },
  { n: 45, title: "Due dates in My issues", priority: 4, column: "unstarted" },
  { n: 39, title: "Sidebar remembers fold", priority: 3, column: "started" },
  { n: 36, title: "Activity shows who moved it", priority: 2, column: "review" },
] as const;
const MOVING = { n: 42, title: "Rank exact key matches", priority: 2 } as const;

const BOARD_STEPS = [1400, 1800, 3000];

export function BoardMockup() {
  const ref = React.useRef<HTMLDivElement>(null);
  const step = useSequence(ref, BOARD_STEPS, { loop: false });
  const movingColumn = COLUMNS[step]!;
  const morph = useMotionTransition(spring.smooth);

  return (
    <div ref={ref}>
      <Mockup label="Board view: a card moves from Todo to In Progress to In Review.">
        <LayoutGroup>
          <div className="grid grid-cols-3 gap-2">
            {COLUMNS.map((column) => (
              <div key={column} className="bg-gray-2 min-w-0 rounded-lg p-1.5">
                <div className="flex items-center gap-1.5 px-1 pt-0.5 pb-2 text-xs">
                  <StatusGlyph category={column} size={12} />
                  <span className="truncate font-medium">{STATUS_NAME[column]}</span>
                </div>
                <div className="space-y-1.5">
                  {movingColumn === column && (
                    <motion.div layoutId="board-moving" transition={morph}>
                      <BoardCard
                        n={MOVING.n}
                        title={MOVING.title}
                        priority={MOVING.priority}
                        lifted
                      />
                    </motion.div>
                  )}
                  {BOARD.filter((card) => card.column === column).map((card) => (
                    <motion.div key={card.n} layout="position" transition={morph}>
                      <BoardCard n={card.n} title={card.title} priority={card.priority} />
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </LayoutGroup>
      </Mockup>
    </div>
  );
}

function BoardCard({
  n,
  title,
  priority,
  lifted,
}: {
  n: number;
  title: string;
  priority: 0 | 1 | 2 | 3 | 4;
  lifted?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-border bg-gray-1 rounded-md border p-2 text-xs",
        lifted && "border-border-strong bg-gray-3",
      )}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <PriorityGlyph priority={priority} size={12} />
        <span className="text-2xs text-muted-foreground font-mono">{issueKey(n)}</span>
      </div>
      <div className="text-foreground line-clamp-3 text-[0.6875rem] leading-4">{title}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Live: activity arrives on Tom's screen while Ana's agent works.
 * ------------------------------------------------------------------------------------------- */

const FEED = [
  { who: people.ana, text: "moved to In Progress", key: issueKey(42), mcp: true },
  { who: people.tom, text: "commented", key: issueKey(39), mcp: false },
  { who: people.ana, text: "created a sub-issue", key: issueKey(49), mcp: true },
  { who: people.ana, text: "moved to In Review", key: issueKey(42), mcp: true },
];

const FEED_STEPS = [900, 1300, 1300, 1300, 3000];

export function LiveMockup() {
  const ref = React.useRef<HTMLDivElement>(null);
  const step = useSequence(ref, FEED_STEPS, { loop: false });
  const appear = useMotionTransition(tween.panelEnter);
  const visible = FEED.slice(0, step).reverse();

  return (
    <div ref={ref}>
      <Mockup label="Activity arrives live: Ana's agent moves and creates issues via MCP while Tom watches.">
        <div className="space-y-1.5">
          <div className="text-muted-foreground flex items-center gap-2 px-1 pb-1 text-xs">
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-[var(--status-done)] opacity-60 motion-reduce:animate-none" />
              <span className="relative size-2 rounded-full bg-[var(--status-done)]" />
            </span>
            Tom&apos;s screen, live
          </div>
          <div className="relative h-[156px] space-y-1.5 overflow-hidden">
            <AnimatePresence initial={false}>
              {visible.map((item) => (
                <motion.div
                  key={`${item.key}-${item.text}`}
                  layout="position"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={appear}
                  className="border-border bg-gray-1 flex h-9 items-center gap-2 rounded-md border px-2.5 text-xs"
                >
                  <MockAvatar person={item.who} size="xs" />
                  <span className="text-muted-foreground truncate">
                    <span className="text-foreground">{item.who.name.split(" ")[0]}</span>{" "}
                    {item.text} <span className="font-mono">{item.key}</span>
                  </span>
                  {item.mcp && <ViaMcp className="ml-auto shrink-0" />}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </Mockup>
    </div>
  );
}
