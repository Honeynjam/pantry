"use client";

import * as React from "react";
import { Tabs } from "@base-ui/react/tabs";
import { useReducedMotion } from "motion/react";
import { cn } from "@pantry/ui/lib/utils";
import { speed } from "@/lib/content";
import { BoardMockup, LiveMockup, PaletteMockup } from "./mockups/speed-mockups";

/** How long each tab shows before the next one, while nobody has picked one. */
const AUTO_ADVANCE_MS = 8000;

const PANELS: Record<string, React.ReactNode> = {
  palette: <PaletteMockup />,
  board: <BoardMockup />,
  live: <LiveMockup />,
};

/**
 * Plane-style feature tabs: three tabs on the left, a live mockup on the right. Tabs advance on
 * their own with a progress line until you pick one. Reduced motion: no auto-advance.
 */
export function SpeedTabs() {
  const [active, setActive] = React.useState(speed.tabs[0]!.id);
  const [picked, setPicked] = React.useState(false);
  const reduce = useReducedMotion();
  const auto = !picked && !reduce;

  const next = React.useCallback(() => {
    setActive((current) => {
      const index = speed.tabs.findIndex((tab) => tab.id === current);
      return speed.tabs[(index + 1) % speed.tabs.length]!.id;
    });
  }, []);

  return (
    <Tabs.Root
      value={active}
      onValueChange={(value) => {
        setActive(value as string);
        setPicked(true);
      }}
      className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]"
    >
      <Tabs.List className="flex flex-col gap-2 max-lg:flex-row max-lg:overflow-x-auto">
        {speed.tabs.map((tab) => (
          <Tabs.Tab
            key={tab.id}
            value={tab.id}
            className={cn(
              "group border-border relative cursor-pointer overflow-hidden rounded-xl border p-5 text-left transition-colors max-lg:min-w-64",
              "text-muted-foreground hover:bg-gray-2 data-[active]:bg-gray-2 data-[active]:text-foreground",
            )}
          >
            <span className="block text-sm font-medium">{tab.label}</span>
            <span className="text-foreground mt-3 block text-lg font-medium max-lg:hidden">
              {tab.title}
            </span>
            <span className="text-body text-muted-foreground mt-1 block max-lg:hidden">
              {tab.body}
            </span>
            {auto && tab.id === active && (
              <span
                aria-hidden
                key={active}
                onAnimationEnd={next}
                className="bg-foreground absolute inset-x-0 bottom-0 h-0.5 origin-left animate-[tab-progress_linear_forwards]"
                style={{ animationDuration: `${AUTO_ADVANCE_MS}ms` }}
              />
            )}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {speed.tabs.map((tab) => (
        <Tabs.Panel
          key={tab.id}
          value={tab.id}
          className="border-border bg-gray-3 flex min-h-[380px] items-center justify-center rounded-2xl border p-5 sm:p-10"
        >
          <div className="w-full max-w-md">
            <p className="text-body text-muted-foreground mb-6 lg:hidden">{tab.body}</p>
            {PANELS[tab.id]}
          </div>
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
