"use client";

import type { Doc } from "@pantry/backend/dataModel";
import { IssueKey } from "@pantry/ui/components/issue-key";
import { LabelChip } from "@pantry/ui/components/label-chip";
import { cn } from "@pantry/ui/lib/utils";
import { CornerDownRightIcon } from "lucide-react";
import { routes, useNavigation } from "../navigation";
import type { IssueActions } from "./actions";
import type { Lookups } from "./lookups";
import { AssigneePicker, DueDatePicker, PriorityPicker, StatusPicker } from "./pickers";
import { SubIssueProgress } from "./sub-issue-progress";

/**
 * One dense list row (32px): priority, key, status, title, parent / sub-issue progress, labels, due
 * date, assignee. The title is a stretched link so the whole row opens the issue; the pickers sit
 * above it and edit in place. `data-issue-id` is the hook for M3's J/K selection.
 */
export function IssueRow({
  issue,
  lookups,
  actions,
  parentKey,
  subIssues,
}: {
  issue: Doc<"issues">;
  lookups: Lookups;
  actions: IssueActions;
  parentKey?: string;
  subIssues?: Doc<"issues">[];
}) {
  const { Link } = useNavigation();
  const { data } = lookups;
  const labels = issue.labelIds.map(lookups.label).filter((label) => label !== undefined);
  return (
    <div
      data-issue-id={issue._id}
      className="group/row relative flex h-row items-center gap-2 border-b border-border px-3 text-sm transition-colors duration-(--duration-instant) last:border-b-0 hover:bg-accent focus-within:bg-accent"
    >
      <PriorityPicker value={issue.priority} onChange={(priority) => void actions.update(issue._id, { priority })} />
      <IssueKey value={issue.key} className="w-14 shrink-0" />
      <StatusPicker
        statuses={data.statuses}
        value={issue.statusId}
        onChange={(statusId) => void actions.move(issue._id, statusId)}
      />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {parentKey && (
          <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground" title={`Sub-issue of ${parentKey}`}>
            <CornerDownRightIcon className="size-3" aria-hidden />
            <span className="font-mono">{parentKey}</span>
          </span>
        )}
        <Link
          href={routes.issue(issue.key)}
          className="min-w-0 truncate text-foreground outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
        >
          {issue.title}
        </Link>
        {subIssues && subIssues.length > 0 && <SubIssueProgress subIssues={subIssues} />}
      </span>
      <span className="relative z-10 hidden max-w-64 items-center gap-1 overflow-hidden md:flex">
        {labels.slice(0, 3).map((label) => (
          <LabelChip key={label._id} name={label.name} color={label.color} />
        ))}
        {labels.length > 3 && <span className="text-xs text-muted-foreground">+{labels.length - 3}</span>}
      </span>
      <span className={cn("relative z-10 hidden lg:flex", !issue.dueDate && "invisible group-hover/row:visible")}>
        <DueDatePicker
          value={issue.dueDate}
          onChange={(dueDate) => void actions.update(issue._id, { dueDate })}
          variant="icon"
        />
      </span>
      <AssigneePicker
        members={data.members}
        me={data.me}
        value={issue.assigneeId}
        onChange={(assigneeId) => void actions.update(issue._id, { assigneeId })}
      />
    </div>
  );
}
