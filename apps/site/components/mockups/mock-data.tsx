import * as React from "react";
import { Avatar, AvatarFallback } from "@pantry/ui/components/avatar";
import { LabelChip } from "@pantry/ui/components/label-chip";
import { PriorityGlyph } from "@pantry/ui/components/priority-glyph";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import type { Priority, StatusCategory } from "@pantry/ui/lib/issue-meta";
import { cn } from "@pantry/ui/lib/utils";
import { issueKey } from "@/lib/content";

export type MockPerson = { name: string; initials: string };
export const people = {
  ana: { name: "Ana Ruiz", initials: "AR" },
  tom: { name: "Tom Lee", initials: "TL" },
} satisfies Record<string, MockPerson>;

export type MockIssue = {
  n: number;
  title: string;
  status: StatusCategory;
  priority: Priority;
  assignee?: MockPerson;
  label?: { name: string; color: string };
};

const feature = { name: "Feature", color: "blue" };
const bug = { name: "Bug", color: "red" };
const design = { name: "Design", color: "pink" };
const mcpLabel = { name: "MCP", color: "teal" };

/** The issue the agent works on in every mockup. */
export const AGENT_ISSUE = 42;

export const issues: MockIssue[] = [
  { n: 48, title: "Export a project as markdown", status: "backlog", priority: 4, label: feature },
  { n: 47, title: "Remember list filters per project", status: "backlog", priority: 0 },
  {
    n: AGENT_ISSUE,
    title: "Command palette: rank exact key matches first",
    status: "unstarted",
    priority: 2,
    assignee: people.ana,
    label: feature,
  },
  {
    n: 44,
    title: "Board columns scroll on small screens",
    status: "unstarted",
    priority: 3,
    assignee: people.tom,
    label: bug,
  },
  { n: 45, title: "Show due dates in My issues", status: "unstarted", priority: 4 },
  {
    n: 40,
    title: "Invite links expire after seven days",
    status: "started",
    priority: 1,
    assignee: people.ana,
    label: bug,
  },
  {
    n: 39,
    title: "Sidebar fold remembers its state",
    status: "started",
    priority: 3,
    assignee: people.tom,
    label: design,
  },
  {
    n: 36,
    title: "Activity log shows who moved what",
    status: "review",
    priority: 2,
    assignee: people.ana,
    label: mcpLabel,
  },
];

export const STATUS_ORDER: StatusCategory[] = ["backlog", "unstarted", "started", "review"];
export const STATUS_NAME: Record<StatusCategory, string> = {
  backlog: "Backlog",
  unstarted: "Todo",
  started: "In Progress",
  review: "In Review",
  done: "Done",
  canceled: "Canceled",
};

export function MockAvatar({
  person,
  size = "sm",
}: {
  person?: MockPerson;
  size?: "xs" | "sm" | "default";
}) {
  if (!person) {
    return <span className="border-gray-8 size-5 shrink-0 rounded-full border border-dashed" />;
  }
  return (
    <Avatar size={size}>
      <AvatarFallback>{person.initials}</AvatarFallback>
    </Avatar>
  );
}

/** "via MCP": the neutral tag the app puts on anything an agent did. */
export function ViaMcp({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "border-border bg-gray-3 text-2xs text-muted-foreground inline-flex h-4.5 items-center rounded-sm border px-1 font-mono",
        className,
      )}
    >
      via MCP
    </span>
  );
}

/** One list row, matching the app's 32px rows. */
export function IssueRow({ issue, selected }: { issue: MockIssue; selected?: boolean }) {
  return (
    <div
      className={cn(
        "h-row border-border flex items-center gap-3 border-b pr-3 pl-4 text-sm transition-colors duration-300",
        selected && "bg-selected",
      )}
    >
      <PriorityGlyph priority={issue.priority} />
      <span className="text-muted-foreground tabular w-12 shrink-0 font-mono text-xs">
        {issueKey(issue.n)}
      </span>
      <StatusGlyph category={issue.status} />
      <span className="text-foreground min-w-0 flex-1 truncate">{issue.title}</span>
      {issue.label && (
        <LabelChip name={issue.label.name} color={issue.label.color} className="max-sm:hidden" />
      )}
      <MockAvatar person={issue.assignee} />
    </div>
  );
}

export function GroupHeader({ status, count }: { status: StatusCategory; count: number }) {
  return (
    <div className="h-row border-border bg-gray-2 flex items-center gap-2 border-b px-4 text-sm">
      <StatusGlyph category={status} />
      <span className="text-foreground font-medium">{STATUS_NAME[status]}</span>
      <span className="text-muted-foreground tabular">{count}</span>
    </div>
  );
}
