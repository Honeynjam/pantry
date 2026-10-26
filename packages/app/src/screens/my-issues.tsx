"use client";

import { api } from "@pantry/backend/api";
import { Button } from "@pantry/ui/components/button";
import { useQuery } from "convex/react";
import { CircleUserRoundIcon, PlusIcon } from "lucide-react";
import { useMemo } from "react";
import { EntryGate } from "../entry";
import { FilterBar, useIssueFilters } from "../issues/filter-bar";
import { applyFilters, EMPTY_FILTERS, hasFilters } from "../issues/filters";
import { useLookups } from "../issues/lookups";
import type { NewIssueDefaults } from "../issues/new-issue-dialog";
import { useAppCommands } from "../shell/app-commands";
import { AppShell, type WorkspaceData } from "../shell/app-shell";
import { NotMemberScreen } from "./not-member";
import { IssueList, issueCount, NoMatches } from "./project";

/** My issues (spec §4): open issues assigned to me (Todo, In Progress, In Review) across projects. */
export function MyIssuesPage() {
  return (
    <EntryGate allow={["ready", "not-member"]}>
      {(state) =>
        state.kind === "not-member" ? (
          <NotMemberScreen />
        ) : (
          <AppShell title={() => <span className="font-medium text-foreground">My issues</span>}>
            {(data) => <MyIssues data={data} />}
          </AppShell>
        )
      }
    </EntryGate>
  );
}

function MyIssues({ data }: { data: WorkspaceData }) {
  const issues = useQuery(api.issues.listMine);
  const lookups = useLookups(data);
  const commands = useAppCommands();
  const { filters, setFilters, setTitle } = useIssueFilters();
  const visible = useMemo(
    () =>
      issues === undefined
        ? undefined
        : applyFilters(issues, filters, { me: data.me._id, statuses: data.statuses, labels: data.labels }),
    [issues, filters, data.me._id, data.statuses, data.labels],
  );
  // New issues from here are mine, in the project I was last in.
  const newIssue = (defaults: NewIssueDefaults = {}) => commands.newIssue({ ...defaults, assigneeId: data.me._id });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-3 py-1.5">
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          setTitle={setTitle}
          lookups={lookups}
          facets={["status", "label", "priority"]}
        />
        <span className="ml-auto text-xs text-muted-foreground tabular" aria-live="polite">
          {issueCount(issues, visible)}
        </span>
        <Button size="sm" onClick={() => newIssue()} data-icon="inline-start">
          <PlusIcon />
          New issue
        </Button>
      </div>
      {issues === undefined || visible === undefined ? null : issues.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <CircleUserRoundIcon className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">Nothing assigned to you</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Open issues assigned to you show up here, across projects. Press I on an issue to take it.
          </p>
        </div>
      ) : visible.length === 0 && hasFilters(filters) ? (
        <NoMatches onClear={() => setFilters(EMPTY_FILTERS)} />
      ) : (
        <IssueList issues={visible} lookups={lookups} newIssue={newIssue} />
      )}
    </div>
  );
}
