"use client";

import { api } from "@pantry/backend/api";
import type { Doc } from "@pantry/backend/dataModel";
import { PersonAvatar } from "@pantry/ui/components/avatar-stack";
import { Button } from "@pantry/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pantry/ui/components/dropdown-menu";
import { IssueKey } from "@pantry/ui/components/issue-key";
import { MarkdownEditor } from "@pantry/ui/components/markdown-editor";
import { Popover, PopoverContent, PopoverTrigger } from "@pantry/ui/components/popover";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import { cn } from "@pantry/ui/lib/utils";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ChevronRightIcon,
  CopyIcon,
  CornerLeftUpIcon,
  FolderIcon,
  LinkIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "../components/confirm-dialog";
import { EntryGate } from "../entry";
import { useIssueActions, type IssueActions } from "../issues/actions";
import { statusColor, useLookups, type Lookups } from "../issues/lookups";
import { AssigneePicker, DueDatePicker, LabelsPicker, PriorityPicker, StatusPicker } from "../issues/pickers";
import { SubIssueProgress } from "../issues/sub-issue-progress";
import { CommentComposer, Timeline } from "../issues/timeline";
import { fullDate, timeAgo } from "../lib/format";
import { routes, useNavigation } from "../navigation";
import { useAppCommands } from "../shell/app-commands";
import { AppShell, type WorkspaceData } from "../shell/app-shell";
import { lastListLocation } from "../shell/locations";
import { useShortcut, useShortcutScope } from "../use-shortcuts";
import { usePaletteActions } from "../palette/palette-actions";
import { projectColor } from "../shell/project-color";
import { describeError } from "./form-error";
import { NotMemberScreen } from "./not-member";

type IssueData = NonNullable<FunctionReturnType<typeof api.issues.get>>;

/** Issue detail (spec §4): description, sub-issues, comments, activity, properties sidebar. */
export function IssuePage({ issueKey }: { issueKey: string }) {
  return (
    <EntryGate allow={["ready", "not-member"]}>
      {(state) =>
        state.kind === "not-member" ? (
          <NotMemberScreen />
        ) : (
          <AppShell title={(data) => <IssueTitle data={data} issueKey={issueKey} />}>
            {(data) => <IssueScreen data={data} issueKey={issueKey} />}
          </AppShell>
        )
      }
    </EntryGate>
  );
}

function IssueTitle({ data, issueKey }: { data: WorkspaceData; issueKey: string }) {
  const { Link } = useNavigation();
  const projectKey = issueKey.split("-")[0]?.toUpperCase() ?? "";
  const project = data.projects.find((p) => p.key === projectKey);
  return (
    <>
      {project && (
        <>
          <Link
            href={routes.project(project.key)}
            className="flex min-w-0 items-center gap-2 rounded-sm text-muted-foreground transition-colors duration-(--duration-instant) hover:text-foreground"
          >
            <span className="size-2 shrink-0 rounded-full" style={{ background: projectColor(project.key) }} aria-hidden />
            <span className="truncate">{project.name}</span>
          </Link>
          <ChevronRightIcon className="size-3.5 shrink-0 text-faint-foreground" aria-hidden />
        </>
      )}
      <IssueKey value={issueKey.toUpperCase()} className="text-foreground" />
    </>
  );
}

function IssueScreen({ data, issueKey }: { data: WorkspaceData; issueKey: string }) {
  const result = useQuery(api.issues.get, { key: issueKey });
  const lookups = useLookups(data);
  if (result === undefined) return null;
  if (result === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">There&apos;s no issue {issueKey.toUpperCase()}</p>
        <p className="max-w-sm text-sm text-muted-foreground">It may have been deleted, or the key is mistyped.</p>
      </div>
    );
  }
  return <IssueDetail key={result.issue._id} result={result} lookups={lookups} />;
}

function IssueDetail({ result, lookups }: { result: IssueData; lookups: Lookups }) {
  const { issue, project, parent, subIssues, comments, activity } = result;
  const actions = useIssueActions();
  const commands = useAppCommands();
  const { navigate } = useNavigation();
  const canHaveSubIssues = issue.parentId === undefined && project?.archivedAt === undefined;
  const newSubIssue = () => {
    if (project && canHaveSubIssues) commands.newIssue({ project, parent: issue });
  };

  useShortcutScope("issue");
  useShortcut("newSubIssue", "issue", () => {
    if (!canHaveSubIssues) {
      toast(issue.parentId ? "Sub-issues can't have sub-issues" : "This project is archived");
      return;
    }
    newSubIssue();
  });
  usePaletteActions(() => [
    ...(canHaveSubIssues
      ? [
          {
            id: "issue:new-sub-issue",
            label: "New sub-issue",
            group: "Actions" as const,
            description: issue.key,
            icon: <PlusIcon />,
            shortcut: "newSubIssue" as const,
            run: newSubIssue,
          },
        ]
      : []),
    {
      id: "issue:copy-key",
      label: "Copy issue key",
      group: "Actions",
      description: issue.key,
      icon: <CopyIcon />,
      run: () => void copyText(issue.key, issue.key),
    },
    {
      id: "issue:copy-link",
      label: "Copy issue link",
      group: "Actions",
      description: issue.key,
      keywords: ["url", "share"],
      icon: <LinkIcon />,
      run: () => void copyText(`${window.location.origin}${routes.issue(issue.key)}`, "link"),
    },
  ]);

  // Back to the list or board it was opened from (filters included), else the project's list.
  useShortcut("escape", "issue", () => navigate(lastListLocation() ?? routes.project(issue.key.split("-")[0]!)));

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8 md:px-10">
          <div className="flex flex-col gap-2">
            {parent && <ParentLink parent={parent} lookups={lookups} />}
            <TitleField issue={issue} actions={actions} />
            <MarkdownEditor
              value={issue.description}
              placeholder="Add a description…"
              aria-label="Description"
              className="-mx-2 rounded-md transition-colors duration-(--duration-instant) hover:bg-gray-2 focus-within:bg-transparent"
              contentClassName="min-h-12 px-2 py-1.5"
              onSave={(description) => void actions.update(issue._id, { description })}
            />
          </div>

          {(subIssues.length > 0 || canHaveSubIssues) && (
            <section aria-labelledby="sub-issues" className="flex flex-col gap-1.5">
              <div className="flex h-7 items-center gap-2">
                <h2 id="sub-issues" className="font-sans text-xs font-medium tracking-normal text-muted-foreground">
                  Sub-issues
                </h2>
                {subIssues.length > 0 && <SubIssueProgress subIssues={subIssues} />}
                {canHaveSubIssues && (
                  <Button
                    size="xs"
                    variant="ghost"
                    className="ml-auto"
                    onClick={newSubIssue}
                    data-icon="inline-start"
                  >
                    <PlusIcon />
                    Add sub-issue
                  </Button>
                )}
              </div>
              {subIssues.length > 0 && <SubIssueList subIssues={subIssues} lookups={lookups} actions={actions} />}
            </section>
          )}

          <section aria-labelledby="activity" className="flex flex-col gap-1">
            <h2 id="activity" className="mb-1 font-sans text-xs font-medium tracking-normal text-muted-foreground">
              Activity
            </h2>
            <Timeline activity={activity} comments={comments} lookups={lookups} />
            <CommentComposer issueId={issue._id} />
          </section>
        </article>
      </div>
      <PropertiesPanel issue={issue} project={project} parent={parent} lookups={lookups} actions={actions} subIssueCount={subIssues.length} />
    </div>
  );
}

function ParentLink({ parent, lookups }: { parent: NonNullable<IssueData["parent"]>; lookups: Lookups }) {
  const { Link } = useNavigation();
  const status = lookups.status(parent.statusId);
  return (
    <Link
      href={routes.issue(parent.key)}
      className="flex w-fit max-w-full items-center gap-1.5 rounded-sm text-xs text-muted-foreground transition-colors duration-(--duration-instant) hover:text-foreground"
    >
      <CornerLeftUpIcon className="size-3" aria-hidden />
      <span>Sub-issue of</span>
      {status && <StatusGlyph category={status.category} color={statusColor(status)} size={12} />}
      <IssueKey value={parent.key} />
      <span className="truncate">{parent.title}</span>
    </Link>
  );
}

/** The title edits in place: Enter or blur saves, Esc puts it back. No line breaks. */
function TitleField({ issue, actions }: { issue: Doc<"issues">; actions: IssueActions }) {
  const [draft, setDraft] = useState(issue.title);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const shown = focused ? draft : issue.title;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, [shown]);

  function commit() {
    setFocused(false);
    const next = draft.trim().replace(/\s+/g, " ");
    if (next && next !== issue.title) void actions.update(issue._id, { title: next });
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      value={shown}
      aria-label="Title"
      maxLength={200}
      onFocus={() => {
        setDraft(issue.title);
        setFocused(true);
      }}
      onChange={(event) => setDraft(event.target.value.replace(/\n/g, " "))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setDraft(issue.title);
          setFocused(false);
          requestAnimationFrame(() => ref.current?.blur());
        }
      }}
      className="-mx-2 resize-none overflow-hidden rounded-md bg-transparent px-2 py-1 font-display text-2xl font-semibold tracking-[-0.012em] text-foreground outline-none transition-colors duration-(--duration-instant) hover:bg-gray-2 focus:bg-transparent"
    />
  );
}

function SubIssueList({
  subIssues,
  lookups,
  actions,
}: {
  subIssues: Doc<"issues">[];
  lookups: Lookups;
  actions: IssueActions;
}) {
  const { Link } = useNavigation();
  return (
    <ul className="flex flex-col overflow-hidden rounded-lg border border-border">
      {subIssues.map((sub) => (
        <li
          key={sub._id}
          className="relative flex h-row items-center gap-2 border-b border-border px-2 text-sm transition-colors duration-(--duration-instant) last:border-b-0 hover:bg-accent"
        >
          <StatusPicker
            statuses={lookups.data.statuses}
            value={sub.statusId}
            onChange={(statusId) => void actions.move(sub._id, statusId)}
          />
          <IssueKey value={sub.key} className="w-14" />
          <Link
            href={routes.issue(sub.key)}
            className="min-w-0 flex-1 truncate text-foreground outline-none after:absolute after:inset-0 focus-visible:underline"
          >
            {sub.title}
          </Link>
          <AssigneePicker
            members={lookups.data.members}
            me={lookups.data.me}
            value={sub.assigneeId}
            onChange={(assigneeId) => void actions.update(sub._id, { assigneeId })}
          />
        </li>
      ))}
    </ul>
  );
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-start gap-2">
      <span className="flex h-7 w-20 shrink-0 items-center text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

function PropertiesPanel({
  issue,
  project,
  parent,
  lookups,
  actions,
  subIssueCount,
}: {
  issue: Doc<"issues">;
  project: Doc<"projects"> | null;
  parent: IssueData["parent"];
  lookups: Lookups;
  actions: IssueActions;
  subIssueCount: number;
}) {
  const { data } = lookups;
  const creator = lookups.member(issue.creatorId);
  return (
    <aside
      aria-label="Properties"
      className="flex shrink-0 flex-col gap-4 overflow-y-auto border-t border-border bg-gray-2 p-4 lg:w-76 lg:border-t-0 lg:border-l"
    >
      <div className="flex items-center gap-1">
        <IssueKey value={issue.key} className="text-foreground" />
        <IssueMenu issue={issue} subIssueCount={subIssueCount} />
      </div>
      <div className="flex flex-col gap-0.5">
        <PropertyRow label="Status">
          <StatusPicker
            statuses={data.statuses}
            value={issue.statusId}
            onChange={(statusId) => void actions.move(issue._id, statusId)}
            variant="full"
          />
        </PropertyRow>
        <PropertyRow label="Priority">
          <PriorityPicker
            value={issue.priority}
            onChange={(priority) => void actions.update(issue._id, { priority })}
            variant="full"
          />
        </PropertyRow>
        <PropertyRow label="Assignee">
          <AssigneePicker
            members={data.members}
            me={data.me}
            value={issue.assigneeId}
            onChange={(assigneeId) => void actions.update(issue._id, { assigneeId })}
            variant="full"
          />
        </PropertyRow>
        <PropertyRow label="Labels">
          <LabelsPicker
            labels={data.labels}
            value={issue.labelIds}
            onChange={(labelIds) => void actions.update(issue._id, { labelIds })}
          />
        </PropertyRow>
        <PropertyRow label="Due date">
          <DueDatePicker
            value={issue.dueDate}
            onChange={(dueDate) => void actions.update(issue._id, { dueDate })}
            variant="full"
          />
        </PropertyRow>
        <PropertyRow label="Project">
          <span className="flex h-7 min-w-0 items-center gap-2 px-2 text-sm text-foreground">
            <FolderIcon className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="truncate">{project?.name ?? "—"}</span>
          </span>
        </PropertyRow>
        <PropertyRow label="Parent">
          <ParentPicker issue={issue} parent={parent} subIssueCount={subIssueCount} actions={actions} />
        </PropertyRow>
      </div>
      <div className="mt-auto flex flex-col gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <PersonAvatar person={{ name: creator?.displayName ?? "?" }} size="xs" />
          Created by {creator?.displayName ?? "someone"}{" "}
          <span title={fullDate(issue._creationTime)}>{timeAgo(issue._creationTime)}</span>
        </span>
        <span title={fullDate(issue.updatedAt)}>Updated {timeAgo(issue.updatedAt)}</span>
      </div>
    </aside>
  );
}

/**
 * Pick or clear the parent: open top-level issues of the same project. Hidden for issues that have
 * sub-issues (one level only; the server enforces it too).
 */
function ParentPicker({
  issue,
  parent,
  subIssueCount,
  actions,
}: {
  issue: Doc<"issues">;
  parent: IssueData["parent"];
  subIssueCount: number;
  actions: IssueActions;
}) {
  const { Link } = useNavigation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const candidates = useQuery(api.issues.listByProject, open ? { projectId: issue.projectId } : "skip");

  if (subIssueCount > 0) {
    return <span className="flex h-7 items-center px-2 text-sm text-muted-foreground">Has sub-issues</span>;
  }
  const options = (candidates ?? [])
    .filter((row) => row._id !== issue._id && row.parentId === undefined)
    .filter((row) => {
      const q = query.trim().toLowerCase();
      return !q || row.key.toLowerCase().includes(q) || row.title.toLowerCase().includes(q);
    })
    .slice(0, 50);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger
          className={cn(
            "flex h-7 min-w-0 flex-1 cursor-default items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors duration-(--duration-instant) hover:bg-accent aria-expanded:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
          )}
          aria-label="Parent issue. Change parent"
        >
          <CornerLeftUpIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {parent ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <IssueKey value={parent.key} className="text-foreground" />
              <span className="truncate text-foreground">{parent.title}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 gap-1 p-1.5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a parent by key or title…"
            aria-label="Find a parent issue"
            autoFocus
            className="h-8 rounded-md bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-faint-foreground"
          />
          <div className="flex max-h-64 flex-col overflow-y-auto border-t border-border pt-1">
            {candidates === undefined ? (
              <span className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</span>
            ) : options.length === 0 ? (
              <span className="px-2 py-1.5 text-sm text-muted-foreground">No matching issues.</span>
            ) : (
              options.map((row) => (
                <button
                  key={row._id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (row._id !== issue.parentId) void actions.update(issue._id, { parentId: row._id });
                  }}
                  className="flex h-7 shrink-0 items-center gap-2 rounded-sm px-2 text-left text-sm text-foreground outline-none hover:bg-accent focus-visible:bg-accent"
                >
                  <IssueKey value={row.key} className="w-14" />
                  <span className="truncate">{row.title}</span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      {parent && (
        <>
          <Link
            href={routes.issue(parent.key)}
            aria-label={`Open ${parent.key}`}
            className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronRightIcon className="size-3" />
          </Link>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Remove parent"
            onClick={() => void actions.update(issue._id, { parentId: null })}
          >
            <XIcon />
          </Button>
        </>
      )}
    </div>
  );
}

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`Copied ${what}`);
  } catch {
    toast.error("Couldn't copy: the browser blocked the clipboard.");
  }
}

function IssueMenu({ issue, subIssueCount }: { issue: Doc<"issues">; subIssueCount: number }) {
  const remove = useMutation(api.issues.remove);
  const { navigate } = useNavigation();
  const [deleting, setDeleting] = useState(false);
  const projectKey = issue.key.split("-")[0]!;
  const copy = copyText;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Issue actions" />}>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={() => void copy(issue.key, issue.key)}>
            <CopyIcon />
            Copy key
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void copy(`${window.location.origin}${routes.issue(issue.key)}`, "link")}>
            <LinkIcon />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDeleting(true)}>
            <Trash2Icon />
            Delete issue…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${issue.key}?`}
        description={
          subIssueCount > 0
            ? `Its ${subIssueCount} sub-issue${subIssueCount === 1 ? "" : "s"}, comments and activity are deleted too. There's no trash: this can't be undone.`
            : "Its comments and activity are deleted too. There's no trash: this can't be undone."
        }
        confirmLabel="Delete issue"
        destructive
        onConfirm={async () => {
          try {
            await remove({ issueId: issue._id });
            toast(`Deleted ${issue.key}`);
            navigate(routes.project(projectKey));
          } catch (err) {
            toast.error(describeError(err, "Couldn't delete the issue."));
          }
        }}
      />
    </>
  );
}
