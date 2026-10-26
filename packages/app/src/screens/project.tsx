"use client";

import { api } from "@pantry/backend/api";
import type { Doc, Id } from "@pantry/backend/dataModel";
import { Button } from "@pantry/ui/components/button";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import { useQuery } from "convex/react";
import { InboxIcon, PlusIcon } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { EntryGate } from "../entry";
import { useIssueActions } from "../issues/actions";
import { IssueRow } from "../issues/issue-row";
import { SelectionProvider, useIssueSelection } from "../issues/selection";
import { statusColor, useLookups, type Lookups } from "../issues/lookups";
import type { NewIssueDefaults } from "../issues/new-issue-dialog";
import { useAppCommands } from "../shell/app-commands";
import { AppShell, type WorkspaceData } from "../shell/app-shell";
import { NotMemberScreen } from "./not-member";
import { ProjectNotFound, ProjectTitle } from "./project-chrome";

/** A project's issues as a list grouped by status (spec §4), live over Convex. */
export function ProjectPage({ projectKey }: { projectKey: string }) {
  return (
    <EntryGate allow={["ready", "not-member"]}>
      {(state) =>
        state.kind === "not-member" ? (
          <NotMemberScreen />
        ) : (
          <AppShell title={(data) => <ProjectTitle data={data} projectKey={projectKey} view="list" />}>
            {(data) => {
              const project = data.projects.find((p) => p.key === projectKey);
              if (!project) return <ProjectNotFound projectKey={projectKey} />;
              return <ProjectIssues key={project._id} data={data} project={project} view="list" />;
            }}
          </AppShell>
        )
      }
    </EntryGate>
  );
}

export type ProjectIssuesView = "list" | "board";

/** Loads the project's issues and hosts the new-issue dialog for both views. */
export function ProjectIssues({
  data,
  project,
  view,
  renderBoard,
}: {
  data: WorkspaceData;
  project: Doc<"projects">;
  view: ProjectIssuesView;
  renderBoard?: (props: BoardProps) => React.ReactNode;
}) {
  const [includeDone, setIncludeDone] = useState(false);
  const issues = useQuery(api.issues.listByProject, { projectId: project._id, includeDone });
  const lookups = useLookups(data);
  const commands = useAppCommands();
  const newIssue = (defaults: NewIssueDefaults = {}) => commands.newIssue({ ...defaults, project });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="text-xs text-muted-foreground">
          {issues === undefined ? "Loading…" : `${issues.length} ${issues.length === 1 ? "issue" : "issues"}`}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          aria-pressed={includeDone}
          onClick={() => setIncludeDone((value) => !value)}
          title="Done and canceled issues older than 14 days are hidden by default"
        >
          {includeDone ? "Hide older done" : "Show older done"}
        </Button>
        <Button size="sm" className="ml-auto" onClick={() => newIssue()} data-icon="inline-start">
          <PlusIcon />
          New issue
        </Button>
      </div>
      {issues === undefined ? null : issues.length === 0 && !includeDone ? (
        <EmptyProject project={project} onCreate={() => newIssue()} />
      ) : view === "board" && renderBoard ? (
        renderBoard({ issues, lookups, project, newIssue })
      ) : (
        <IssueList issues={issues} lookups={lookups} newIssue={newIssue} />
      )}
    </div>
  );
}

export type BoardProps = {
  issues: Doc<"issues">[];
  lookups: Lookups;
  project: Doc<"projects">;
  newIssue: (defaults?: NewIssueDefaults) => void;
};

/** Parent keys and sub-issue lists, from the issues already loaded. */
export function useIssueFamily(issues: Doc<"issues">[]) {
  return useMemo(() => {
    const byId = new Map(issues.map((issue) => [issue._id, issue]));
    const children = new Map<Id<"issues">, Doc<"issues">[]>();
    for (const issue of issues) {
      if (!issue.parentId) continue;
      children.set(issue.parentId, [...(children.get(issue.parentId) ?? []), issue]);
    }
    return { byId, children };
  }, [issues]);
}

function IssueList({
  issues,
  lookups,
  newIssue,
}: {
  issues: Doc<"issues">[];
  lookups: Lookups;
  newIssue: (defaults?: NewIssueDefaults) => void;
}) {
  const actions = useIssueActions();
  const family = useIssueFamily(issues);
  const container = useRef<HTMLDivElement>(null);
  const groups = useMemo(
    () =>
      lookups.data.statuses
        .map((status) => ({ status, issues: issues.filter((issue) => issue.statusId === status._id) }))
        .filter((group) => group.issues.length > 0),
    [lookups.data.statuses, issues],
  );
  const ordered = useMemo(() => groups.flatMap((group) => group.issues), [groups]);
  const selection = useIssueSelection({ ordered, lookups, actions, container });

  return (
    <SelectionProvider value={selection.value}>
    {/* layoutScroll: the cursor highlight measures rows correctly while the list is scrolled. */}
    <motion.div ref={container} layoutScroll className="min-h-0 flex-1 overflow-y-auto">
      {groups.map(({ status, issues: rows }) => (
        <section key={status._id} aria-label={status.name}>
          <div className="sticky top-0 z-20 flex h-8 items-center gap-2 border-b border-border bg-gray-2 px-3">
            <StatusGlyph category={status.category} color={statusColor(status)} />
            <h2 className="font-sans text-sm font-medium tracking-normal text-foreground">{status.name}</h2>
            <span className="font-mono text-xs text-muted-foreground tabular">{rows.length}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="ml-auto"
              aria-label={`New issue in ${status.name}`}
              onClick={() => newIssue({ statusId: status._id })}
            >
              <PlusIcon />
            </Button>
          </div>
          {rows.map((issue) => (
            <IssueRow
              key={issue._id}
              issue={issue}
              lookups={lookups}
              actions={actions}
              parentKey={issue.parentId ? family.byId.get(issue.parentId)?.key : undefined}
              subIssues={family.children.get(issue._id)}
            />
          ))}
        </section>
      ))}
    </motion.div>
    {selection.element}
    </SelectionProvider>
  );
}

function EmptyProject({ project, onCreate }: { project: Doc<"projects">; onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <InboxIcon className="size-5 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium text-foreground">No issues in {project.name} yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Issues you create here, or that your agents create over MCP, show up grouped by status.
      </p>
      <Button className="mt-2" onClick={onCreate} data-icon="inline-start">
        <PlusIcon />
        New issue
      </Button>
    </div>
  );
}
