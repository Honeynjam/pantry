"use client";

import * as React from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Bot, Home, Inbox, ListFilter, Plus, Search, Settings } from "lucide-react";
import { LogoMark } from "@pantry/ui/components/logo-mark";
import { PantryAvatar } from "@pantry/ui/components/pantry-avatar";
import { BRAND_AVATAR } from "@/lib/brand-avatar";
import { spring, tween, useMotionTransition } from "@pantry/ui/lib/motion";
import type { StatusCategory } from "@pantry/ui/lib/issue-meta";
import { cn } from "@pantry/ui/lib/utils";
import { brandName, issueKey } from "@/lib/content";
import { useSequence } from "@/components/motion/use-sequence";
import { AppWindow, Mockup } from "./app-window";
import {
  AGENT_ISSUE,
  GroupHeader,
  IssueRow,
  issues,
  MockAvatar,
  people,
  STATUS_NAME,
  STATUS_ORDER,
  ViaMcp,
} from "./mock-data";

/**
 * The hero's product shot, live: the agent picks up PAN-42, moves it to In Progress, comments,
 * then hands it to review. Plays once when it comes into view; reduced motion shows the last frame.
 */
const STEPS = [
  { status: "unstarted", toast: null },
  { status: "unstarted", toast: "read" },
  { status: "started", toast: "moved" },
  { status: "started", toast: "comment" },
  { status: "review", toast: "review" },
] as const satisfies { status: StatusCategory; toast: string | null }[];
const DURATIONS = [1800, 1600, 2200, 2200, 4000];

export function HeroMockup() {
  const ref = React.useRef<HTMLDivElement>(null);
  const step = useSequence(ref, DURATIONS, { loop: false });
  const { status, toast } = STEPS[step]!;
  const layout = useMotionTransition(spring.morph);
  const fade = useMotionTransition(tween.panelEnter);

  const rows = issues.map((issue) => (issue.n === AGENT_ISSUE ? { ...issue, status } : issue));

  return (
    <div ref={ref}>
      <Mockup
        label={`${brandName} list view: an agent moves ${issueKey(AGENT_ISSUE)} from Todo to In Progress, comments, then sends it to In Review, all tagged via MCP.`}
      >
        <AppWindow
          className="rounded-b-none text-left"
          bodyClassName="flex h-[560px] max-md:h-[460px]"
        >
          {/* Sidebar */}
          <aside className="border-border bg-gray-1 flex w-56 shrink-0 flex-col gap-0.5 border-r p-2 max-lg:hidden">
            <div className="mb-2 flex items-center gap-2 px-2 py-1.5">
              <LogoMark name="Northwind" size="sm" />
              <span className="text-sm font-medium">Northwind</span>
            </div>
            <div className="border-border text-faint-foreground mb-2 flex h-7 items-center gap-2 rounded-md border px-2 text-xs">
              <Search className="size-3.5" />
              Search
              <span className="text-2xs ml-auto font-mono">⌘K</span>
            </div>
            <SidebarItem icon={<Home className="size-4" />} label="Home" />
            <SidebarItem icon={<Inbox className="size-4" />} label="My issues" count={4} />
            <div className="text-muted-foreground mt-4 mb-1 px-2 text-xs">Spaces</div>
            <SidebarItem
              avatar={<PantryAvatar {...BRAND_AVATAR} size="sm" />}
              label={brandName}
              meta="PAN"
              active
            />
            <SidebarItem
              avatar={<PantryAvatar seed="WEB" shape="toast" color="violet" size="sm" />}
              label="Website"
              meta="WEB"
            />
            <SidebarItem
              avatar={<PantryAvatar seed="FRN" shape="honey" color="orange" size="sm" />}
              label="Client: Fern"
              meta="FRN"
            />
            <div className="mt-auto">
              <SidebarItem icon={<Settings className="size-4" />} label="Settings" />
            </div>
          </aside>

          {/* Main */}
          <div className="relative flex min-w-0 flex-1 flex-col">
            <div className="border-border flex h-11 shrink-0 items-center gap-3 border-b px-4 text-sm">
              <PantryAvatar {...BRAND_AVATAR} size="sm" />
              <span className="font-medium">{brandName}</span>
              <span className="text-muted-foreground font-mono text-xs">PAN</span>
              <div className="ml-2 flex items-center gap-1 text-sm">
                <span className="bg-gray-4 text-foreground rounded-md px-2 py-0.5">List</span>
                <span className="text-muted-foreground px-2 py-0.5">Board</span>
                <span className="text-muted-foreground px-2 py-0.5 max-sm:hidden">Context</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <ListFilter className="text-muted-foreground size-4 max-sm:hidden" />
                <span className="bg-primary text-primary-foreground inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium whitespace-nowrap">
                  <Plus className="size-3.5" />
                  New issue
                </span>
              </div>
            </div>

            <LayoutGroup>
              <div className="min-h-0 flex-1 overflow-hidden">
                {STATUS_ORDER.map((group) => {
                  const inGroup = rows.filter((issue) => issue.status === group);
                  return (
                    <React.Fragment key={group}>
                      <motion.div layout="position" transition={layout}>
                        <GroupHeader status={group} count={inGroup.length} />
                      </motion.div>
                      {inGroup.map((issue) => (
                        <motion.div key={issue.n} layoutId={`hero-${issue.n}`} transition={layout}>
                          <IssueRow issue={issue} selected={issue.n === AGENT_ISSUE && step > 0} />
                        </motion.div>
                      ))}
                    </React.Fragment>
                  );
                })}
              </div>
            </LayoutGroup>

            <div className="pointer-events-none absolute right-4 bottom-4 left-4 flex justify-end">
              <AnimatePresence mode="wait">
                {toast && (
                  <motion.div
                    key={toast}
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, transition: tween.panelExit }}
                    transition={fade}
                    className="bg-popover shadow-overlay flex max-w-sm items-start gap-2.5 rounded-xl p-3 text-sm"
                  >
                    <MockAvatar person={people.ana} />
                    <div className="min-w-0 space-y-1">
                      <ToastText kind={toast} />
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <ViaMcp />
                        <span className="flex items-center gap-1">
                          <Bot className="size-3" />
                          Claude Code
                        </span>
                        <span>just now</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </AppWindow>
      </Mockup>
    </div>
  );
}

function ToastText({ kind }: { kind: (typeof STEPS)[number]["toast"] }) {
  const key = <span className="font-mono text-xs">{issueKey(AGENT_ISSUE)}</span>;
  const who = <span className="font-medium">{people.ana.name}</span>;
  switch (kind) {
    case "read":
      return (
        <p className="text-muted-foreground">
          {who} read {key} and the space&apos;s context doc
        </p>
      );
    case "moved":
      return (
        <p className="text-muted-foreground">
          {who} moved {key} to <span className="text-foreground">{STATUS_NAME.started}</span>
        </p>
      );
    case "comment":
      return (
        <p className="text-muted-foreground">
          {who} commented on {key}:{" "}
          <span className="text-foreground">
            “Exact key matches now rank first. Added 6 tests.”
          </span>
        </p>
      );
    case "review":
      return (
        <p className="text-muted-foreground">
          {who} moved {key} to <span className="text-foreground">{STATUS_NAME.review}</span>
        </p>
      );
    default:
      return null;
  }
}

function SidebarItem({
  icon,
  avatar,
  label,
  meta,
  count,
  active,
}: {
  icon?: React.ReactNode;
  avatar?: React.ReactNode;
  label: string;
  meta?: string;
  count?: number;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex h-7 items-center gap-2 rounded-md px-2 text-sm",
        active && "bg-gray-4 text-foreground",
      )}
    >
      {icon}
      {avatar}
      <span className="truncate">{label}</span>
      {meta && <span className="text-2xs text-muted-foreground ml-auto font-mono">{meta}</span>}
      {count !== undefined && <span className="tabular ml-auto text-xs">{count}</span>}
    </div>
  );
}
