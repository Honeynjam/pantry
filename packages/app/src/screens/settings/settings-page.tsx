"use client";

import { cn } from "@pantry/ui/lib/utils";
import { spring, useMotionTransition } from "@pantry/ui/lib/motion";
import { motion } from "motion/react";
import { UsersIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EntryGate } from "../../entry";
import { routes, useNavigation, type SettingsSection } from "../../navigation";
import { AppShell, type WorkspaceData } from "../../shell/app-shell";
import { NotMemberScreen } from "../not-member";
import { MembersSettings } from "./members";

type SectionDef = { id: SettingsSection; label: string; icon: LucideIcon; render: (data: WorkspaceData) => ReactNode };

const SECTIONS: SectionDef[] = [
  { id: "members", label: "Members", icon: UsersIcon, render: (data) => <MembersSettings data={data} /> },
];

/** Workspace settings: members and invites, projects, labels, statuses (spec §4). */
export function SettingsPage({ section }: { section: string }) {
  const current = SECTIONS.find((item) => item.id === section);
  return (
    <EntryGate allow={["ready", "not-member"]}>
      {(state) =>
        state.kind === "not-member" ? (
          <NotMemberScreen />
        ) : (
          <AppShell
            title={() => (
              <>
                <span className="text-muted-foreground">Settings</span>
                <span className="text-faint-foreground" aria-hidden>
                  /
                </span>
                <span className="font-medium text-foreground">{current?.label ?? "Not found"}</span>
              </>
            )}
          >
            {(data) => (
              <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                <SettingsNav active={current?.id} />
                <div className="flex min-w-0 flex-1 justify-center overflow-y-auto px-6 py-8 md:px-10">
                  {current ? (
                    current.render(data)
                  ) : (
                    <p className="text-sm text-muted-foreground">There&apos;s no settings page called “{section}”.</p>
                  )}
                </div>
              </div>
            )}
          </AppShell>
        )
      }
    </EntryGate>
  );
}

function SettingsNav({ active }: { active: SettingsSection | undefined }) {
  const { Link } = useNavigation();
  const transition = useMotionTransition(spring.morph);
  return (
    <nav aria-label="Settings" className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-border p-2 md:w-48 md:flex-col md:border-r md:border-b-0">
      <span className="hidden px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground md:block">Workspace</span>
      {SECTIONS.map((item) => {
        const isActive = item.id === active;
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            href={routes.settings(item.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex h-7 shrink-0 items-center gap-2 rounded-md px-2 text-sm transition-colors duration-(--duration-instant)",
              isActive ? "font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="settings-nav-active"
                transition={transition}
                aria-hidden
                className="absolute inset-0 rounded-md bg-selected"
              />
            )}
            <Icon className="relative size-3.5" aria-hidden />
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
