"use client";

import * as React from "react";
import { motion } from "motion/react";
import { CalendarIcon, FolderIcon, PlusIcon } from "lucide-react";
import { AvatarStack, PersonAvatar } from "@pantry/ui/components/avatar-stack";
import { Badge } from "@pantry/ui/components/badge";
import { Button } from "@pantry/ui/components/button";
import { IssueKey } from "@pantry/ui/components/issue-key";
import { Keycap } from "@pantry/ui/components/keycap";
import { LabelChip } from "@pantry/ui/components/label-chip";
import { PriorityGlyph } from "@pantry/ui/components/priority-glyph";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  STATUS_CATEGORIES,
  STATUS_CATEGORY_LABEL,
  type Priority,
  type StatusCategory,
} from "@pantry/ui/lib/issue-meta";
import { spring, useMotionTransition } from "@pantry/ui/lib/motion";
import { useDesignBrand } from "./brand";
import { Section, Specimen, SubSection } from "./section";

type SampleIssue = {
  number: number;
  title: string;
  status: StatusCategory;
  priority: Priority;
  labels: { name: string; color: string }[];
  due?: string;
  assignee?: string;
  via?: "mcp";
};

const ISSUES: SampleIssue[] = [
  { number: 42, title: "Sign-up guard rejects stale invites", status: "started", priority: 1, labels: [{ name: "Auth", color: "violet" }], due: "Oct 28", assignee: "Kris Owner", via: "mcp" },
  { number: 39, title: "Board drag keeps order after reload", status: "started", priority: 2, labels: [{ name: "Board", color: "blue" }], assignee: "Partner Member" },
  { number: 37, title: "Context doc editor saves on blur", status: "started", priority: 3, labels: [], due: "Nov 2", assignee: "Kris Owner" },
  { number: 38, title: "Design tokens for light and dark", status: "review", priority: 2, labels: [{ name: "Design", color: "pink" }, { name: "M1", color: "gray" }], assignee: "Kris Owner" },
  { number: 35, title: "Invite links expire after seven days", status: "review", priority: 4, labels: [{ name: "Auth", color: "violet" }], assignee: "Partner Member", via: "mcp" },
  { number: 44, title: "MCP get_issue returns sub-issues and comments", status: "unstarted", priority: 0, labels: [{ name: "MCP", color: "teal" }] },
];

const GROUPS: StatusCategory[] = ["started", "review", "unstarted"];

function IssueList() {
  const brand = useDesignBrand();
  const ordered = GROUPS.flatMap((group) => ISSUES.filter((issue) => issue.status === group));
  const [active, setActive] = React.useState(0);
  const layoutId = React.useId();
  const baseId = React.useId();
  const transition = useMotionTransition(spring.morph);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "j" || event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, ordered.length - 1));
    } else if (event.key === "k" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    }
  };

  return (
    <div
      role="listbox"
      aria-label="Issues"
      aria-activedescendant={`${baseId}-${ordered[active]?.number}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="overflow-hidden rounded-lg border border-border bg-background focus-visible:outline-offset-0"
    >
      {GROUPS.map((group) => {
        const issues = ordered.filter((issue) => issue.status === group);
        return (
          <div key={group} role="group" aria-label={STATUS_CATEGORY_LABEL[group]}>
            <div className="flex h-8 items-center gap-2 border-b border-border bg-gray-2 px-3 first:border-t-0">
              <StatusGlyph category={group} />
              <span className="text-sm font-medium text-foreground">{STATUS_CATEGORY_LABEL[group]}</span>
              <span className="font-mono text-xs text-faint-foreground tabular">{issues.length}</span>
              <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label={`New issue in ${STATUS_CATEGORY_LABEL[group]}`}>
                <PlusIcon />
              </Button>
            </div>
            {issues.map((issue) => {
              const index = ordered.indexOf(issue);
              const selected = index === active;
              return (
                <div
                  key={issue.number}
                  id={`${baseId}-${issue.number}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(index)}
                  className="relative flex h-row cursor-default items-center gap-3 border-b border-border px-3 last:border-b-0"
                >
                  {selected && (
                    <motion.span
                      layoutId={layoutId}
                      transition={transition}
                      aria-hidden
                      className="absolute inset-0 bg-accent"
                    />
                  )}
                  <span className="relative flex min-w-0 flex-1 items-center gap-3">
                    <PriorityGlyph priority={issue.priority} />
                    <IssueKey value={`${brand.defaultKey}-${issue.number}`} className="w-12" />
                    <StatusGlyph category={issue.status} />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{issue.title}</span>
                    {issue.via && (
                      <Badge variant="outline" className="hidden sm:inline-flex">
                        via MCP
                      </Badge>
                    )}
                    <span className="hidden items-center gap-1 md:flex">
                      {issue.labels.map((label) => (
                        <LabelChip key={label.name} name={label.name} color={label.color} />
                      ))}
                    </span>
                    {issue.due && (
                      <span className="hidden w-12 items-center gap-1 font-mono text-2xs text-muted-foreground tabular lg:flex">
                        {issue.due}
                      </span>
                    )}
                    {issue.assignee ? (
                      <PersonAvatar person={{ name: issue.assignee }} size="sm" />
                    ) : (
                      <span className="size-5 rounded-full border border-dashed border-gray-8" aria-label="Unassigned" />
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function BoardColumn({ category }: { category: StatusCategory }) {
  const brand = useDesignBrand();
  const issues = ISSUES.filter((issue) => issue.status === category);
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg bg-gray-2 p-2">
      <div className="flex h-6 items-center gap-2 px-1">
        <StatusGlyph category={category} />
        <span className="text-sm font-medium text-foreground">{STATUS_CATEGORY_LABEL[category]}</span>
        <span className="font-mono text-xs text-faint-foreground tabular">{issues.length}</span>
      </div>
      {issues.map((issue) => (
        <div
          key={issue.number}
          className="flex cursor-default flex-col gap-2 rounded-md bg-background p-2.5 shadow-raised dark:bg-gray-3 transition-[box-shadow] duration-(--duration-instant) hover:shadow-[0_0_0_1px_var(--border-strong),0_1px_2px_oklch(0_0_0/0.06)]"
        >
          <div className="flex items-center justify-between">
            <IssueKey value={`${brand.defaultKey}-${issue.number}`} />
            {issue.assignee && <PersonAvatar person={{ name: issue.assignee }} size="xs" />}
          </div>
          <span className="line-clamp-2 text-sm leading-5 text-foreground">{issue.title}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex h-5 items-center rounded-sm border border-border px-1">
              <PriorityGlyph priority={issue.priority} size={12} />
            </span>
            {issue.labels.map((label) => (
              <LabelChip key={label.name} name={label.name} color={label.color} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-8 items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function PropertiesPanel() {
  const brand = useDesignBrand();
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-gray-2 p-3">
      <PropertyRow label="Status">
        <Button size="sm" variant="ghost" className="text-foreground" data-icon="inline-start">
          <StatusGlyph category="started" />
          In Progress
        </Button>
      </PropertyRow>
      <PropertyRow label="Priority">
        <Button size="sm" variant="ghost" className="text-foreground" data-icon="inline-start">
          <PriorityGlyph priority={1} />
          Urgent
        </Button>
      </PropertyRow>
      <PropertyRow label="Assignee">
        <Button size="sm" variant="ghost" className="text-foreground" data-icon="inline-start">
          <PersonAvatar person={{ name: "Kris Owner" }} size="xs" />
          Kris
        </Button>
      </PropertyRow>
      <PropertyRow label="Labels">
        <div className="flex flex-wrap gap-1">
          <LabelChip name="Auth" color="violet" />
          <LabelChip name="M1" color="gray" />
        </div>
      </PropertyRow>
      <PropertyRow label="Due date">
        <Button size="sm" variant="ghost" className="text-foreground" data-icon="inline-start">
          <CalendarIcon />
          <span className="font-mono text-xs tabular">Oct 28</span>
        </Button>
      </PropertyRow>
      <PropertyRow label="Project">
        <Button size="sm" variant="ghost" className="text-foreground" data-icon="inline-start">
          <FolderIcon />
          {brand.name}
        </Button>
      </PropertyRow>
    </div>
  );
}

export function PartsSection() {
  const brand = useDesignBrand();
  return (
    <Section
      id="parts"
      title="Pantry parts"
      description="Our own small components on top of shadcn: status and priority glyphs, label chips, issue keys, keycaps and avatar stacks."
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <SubSection title="Status glyph" hint="12 / 14 / 16 · recolourable">
          <Specimen className="flex-col items-start gap-3">
            {[12, 14, 16].map((size) => (
              <div key={size} className="flex items-center gap-3">
                {STATUS_CATEGORIES.map((category) => (
                  <StatusGlyph key={category} category={category} size={size} />
                ))}
                <span className="font-mono text-2xs text-faint-foreground">{size}px</span>
              </div>
            ))}
            <div className="flex items-center gap-3">
              {["#e5484d", "#3e63dd", "#30a46c"].map((color) => (
                <StatusGlyph key={color} category="started" color={color} />
              ))}
              <span className="text-2xs text-faint-foreground">user colours</span>
            </div>
          </Specimen>
        </SubSection>
        <SubSection title="Priority glyph" hint="12 / 14 / 16">
          <Specimen className="flex-col items-start gap-3">
            {[12, 14, 16].map((size) => (
              <div key={size} className="flex items-center gap-3">
                {PRIORITIES.map((priority) => (
                  <PriorityGlyph key={priority} priority={priority} size={size} title={PRIORITY_LABEL[priority]} />
                ))}
                <span className="font-mono text-2xs text-faint-foreground">{size}px</span>
              </div>
            ))}
          </Specimen>
        </SubSection>
        <SubSection title="Label chip, issue key, avatar stack">
          <Specimen className="gap-2">
            <LabelChip name="Bug" color="red" />
            <LabelChip name="Feature" color="blue" />
            <LabelChip name="A rather long label name" color="green" />
            <LabelChip name="#7c66dc" color="#7c66dc" />
            <IssueKey value={`${brand.defaultKey}-7`} />
            <IssueKey value={`${brand.defaultKey}-1024`} />
            <AvatarStack people={[{ name: "Kris Owner" }, { name: "Partner Member" }]} size="sm" />
          </Specimen>
        </SubSection>
        <SubSection title="Keycap sequences">
          <Specimen className="gap-3">
            <Keycap keys="mod+k" />
            <Keycap keys="g b" />
            <Keycap keys="shift+c" />
            <Keycap keys="escape" />
            <Keycap keys="mod+shift+." />
          </Specimen>
        </SubSection>
      </div>
    </Section>
  );
}

export function CompositionSection() {
  return (
    <Section
      id="in-context"
      title="In context"
      description="The pieces together at real density: a project list grouped by status, board cards and the issue properties panel. Hover a row, or focus the list and press J / K: one highlight glides on spring.morph."
    >
      <SubSection title="List" hint={<span className="inline-flex items-center gap-1"><Keycap keys="j" /> <Keycap keys="k" /> to move</span>}>
        <IssueList />
      </SubSection>
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_18rem]">
        <SubSection title="Board">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BoardColumn category="started" />
            <BoardColumn category="review" />
          </div>
        </SubSection>
        <SubSection title="Properties">
          <PropertiesPanel />
        </SubSection>
      </div>
    </Section>
  );
}
