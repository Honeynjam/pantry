"use client";

import { cn } from "@pantry/ui/lib/utils";
import { spring, useMotionTransition } from "@pantry/ui/lib/motion";
import { motion } from "motion/react";
import { CircleDashedIcon, FolderIcon, KeyRoundIcon, TagIcon, UsersIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EntryGate } from "../../entry";
import { routes, useNavigation, type SettingsSection } from "../../navigation";
import { AppShell, type WorkspaceData } from "../../shell/app-shell";
import { NotMemberScreen } from "../not-member";
import { LabelsSettings } from "./labels";
import { MembersSettings } from "./members";
import { SpacesSettings } from "./spaces";
import { StatusesSettings } from "./statuses";
import { TokensSettings } from "./tokens";

type SectionDef = {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  group: "Workspace" | "Account";
  render: (data: WorkspaceData) => ReactNode;
};

const SECTIONS: SectionDef[] = [
  { id: "members", label: "Members", icon: UsersIcon, group: "Workspace", render: (data) => <MembersSettings data={data} /> },
  { id: "spaces", label: "Spaces", icon: FolderIcon, group: "Workspace", render: (data) => <SpacesSettings data={data} /> },
  { id: "labels", label: "Labels", icon: TagIcon, group: "Workspace", render: (data) => <LabelsSettings data={data} /> },
  { id: "statuses", label: "Statuses", icon: CircleDashedIcon, group: "Workspace", render: (data) => <StatusesSettings data={data} /> },
  { id: "tokens", label: "API tokens", icon: KeyRoundIcon, group: "Account", render: () => <TokensSettings /> },
];

const GROUPS = ["Workspace", "Account"] as const;

/** Workspace settings (members and invites, spaces, labels, statuses) and my API tokens (spec §4, §6). */
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
  return (
    <nav aria-label="Settings" className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-border p-2 md:w-48 md:flex-col md:border-r md:border-b-0">
      {GROUPS.map((group, index) => (
        <SettingsNavGroup
          key={group}
          title={group}
          first={index === 0}
          items={SECTIONS.filter((item) => item.group === group)}
          active={active}
        />
      ))}
    </nav>
  );
}

function SettingsNavGroup({
  title,
  first,
  items,
  active,
}: {
  title: string;
  first: boolean;
  items: SectionDef[];
  active: SettingsSection | undefined;
}) {
  const { Link } = useNavigation();
  const transition = useMotionTransition(spring.morph);
  return (
    <>
      <span className={cn("hidden px-2 pb-1.5 text-xs font-medium text-muted-foreground md:block", first ? "pt-1" : "pt-4")}>
        {title}
      </span>
      {items.map((item) => {
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
    </>
  );
}
