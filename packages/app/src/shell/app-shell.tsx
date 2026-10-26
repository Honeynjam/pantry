"use client";

import { api } from "@pantry/backend/api";
import { brand } from "@pantry/backend/brand";
import { LogoMark } from "@pantry/ui/components/logo-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@pantry/ui/components/sidebar";
import { spring, useMotionTransition } from "@pantry/ui/lib/motion";
import type { FunctionReturnType } from "convex/server";
import { useQuery } from "convex/react";
import { HouseIcon } from "lucide-react";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { routes, useNavigation } from "../navigation";
import { LoadingScreen } from "../screens/loading";
import { projectColor } from "./project-color";
import { UserMenu } from "./user-menu";

export type WorkspaceData = FunctionReturnType<typeof api.workspace.current>;

const SIDEBAR_KEY = `${brand.name.toLowerCase()}-sidebar-open`;

function readSidebarOpen(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== "false";
  } catch {
    return true;
  }
}

/** One highlight for the whole nav: it glides between items on spring.morph (reduced: fades). */
function NavItem({
  href,
  tooltip,
  active,
  badge,
  children,
}: {
  href: string;
  tooltip: string;
  active: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const { Link } = useNavigation();
  const transition = useMotionTransition(spring.morph);
  return (
    <SidebarMenuItem>
      {active && (
        <motion.span
          layoutId="sidebar-active"
          transition={transition}
          aria-hidden
          className="absolute inset-0 rounded-md bg-selected"
        />
      )}
      <SidebarMenuButton
        render={<Link href={href} aria-current={active ? "page" : undefined} />}
        tooltip={tooltip}
        className={active ? "relative font-medium text-foreground hover:bg-transparent" : "relative"}
      >
        {children}
      </SidebarMenuButton>
      {badge !== undefined && <SidebarMenuBadge>{badge}</SidebarMenuBadge>}
    </SidebarMenuItem>
  );
}

function AppSidebar({ data }: { data: WorkspaceData }) {
  const { pathname } = useNavigation();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<div />} size="lg" tooltip={data.workspace.name} className="hover:bg-transparent">
              <LogoMark name={data.workspace.name} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">{data.workspace.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {data.members.length} {data.members.length === 1 ? "member" : "members"}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <NavItem href={routes.home} tooltip="Home" active={pathname === routes.home}>
              <HouseIcon />
              <span>Home</span>
            </NavItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.projects.map((project) => (
                <NavItem
                  key={project._id}
                  href={routes.project(project.key)}
                  tooltip={project.name}
                  active={pathname === routes.project(project.key)}
                  badge={project.key}
                >
                  <span className="flex size-4 items-center justify-center" aria-hidden>
                    <span className="size-2 rounded-full" style={{ background: projectColor(project.key) }} />
                  </span>
                  <span>{project.name}</span>
                </NavItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu displayName={data.me.displayName} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/** Sidebar + page frame. The collapsed state is saved per device. */
export function AppShell({
  title,
  children,
}: {
  title: (data: WorkspaceData) => ReactNode;
  children: (data: WorkspaceData) => ReactNode;
}) {
  const data = useQuery(api.workspace.current);
  const [open, setOpen] = useState(readSidebarOpen);
  if (data === undefined) return <LoadingScreen diagnostics={() => ({ waitingFor: "workspace.current" })} />;
  return (
    <SidebarProvider
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        try {
          localStorage.setItem(SIDEBAR_KEY, String(next));
        } catch {
          // Storage can be unavailable; the choice still applies for this session.
        }
      }}
    >
      <AppSidebar data={data} />
      <SidebarInset className="min-w-0">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
          <SidebarTrigger />
          <div className="flex min-w-0 items-center gap-2 text-sm">{title(data)}</div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col">{children(data)}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
