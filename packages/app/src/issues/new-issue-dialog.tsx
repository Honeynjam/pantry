"use client";

import { api } from "@pantry/backend/api";
import type { Doc, Id } from "@pantry/backend/dataModel";
import { Button } from "@pantry/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@pantry/ui/components/dialog";
import { IssueKey } from "@pantry/ui/components/issue-key";
import { Keycap } from "@pantry/ui/components/keycap";
import type { Priority } from "@pantry/ui/lib/issue-meta";
import { useMutation } from "convex/react";
import { ChevronRightIcon } from "lucide-react";
import { Suspense, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { MarkdownEditor, type MarkdownEditorHandle } from "../components/markdown-editor";
import { SpaceAvatar } from "../components/space-avatar";
import { routes, useNavigation } from "../navigation";
import { useShortcutScope } from "../use-shortcuts";
import { describeError, FormError } from "../screens/form-error";
import type { WorkspaceData } from "../shell/app-shell";
import { AssigneePicker, DueDatePicker, LabelsPicker, PriorityPicker, ProjectPicker, StatusPicker } from "./pickers";

export type NewIssueDefaults = {
  statusId?: Id<"statuses">;
  parent?: Pick<Doc<"issues">, "_id" | "key" | "title" | "projectId">;
  assigneeId?: Id<"members">;
  projectId?: Id<"projects">;
};

/**
 * Title, markdown description and properties; Cmd/Ctrl+Enter creates. Sub-issues pass `parent` and
 * land in the parent's space and project (the server enforces it too).
 */
export function NewIssueDialog({
  open,
  onOpenChange,
  data,
  space,
  defaults = {},
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: WorkspaceData;
  space: Doc<"spaces">;
  defaults?: NewIssueDefaults;
}) {
  useShortcutScope("overlay", open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl" showCloseButton={false}>
        {open && <NewIssueForm data={data} space={space} defaults={defaults} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function defaultStatus(data: WorkspaceData) {
  return (data.statuses.find((status) => status.category === "unstarted") ?? data.statuses[0])!._id;
}

function NewIssueForm({
  data,
  space,
  defaults,
  onDone,
}: {
  data: WorkspaceData;
  space: Doc<"spaces">;
  defaults: NewIssueDefaults;
  onDone: () => void;
}) {
  const create = useMutation(api.issues.create);
  const { navigate } = useNavigation();
  const description = useRef<MarkdownEditorHandle>(null);
  const [title, setTitle] = useState("");
  const [statusId, setStatusId] = useState<Id<"statuses">>(defaults.statusId ?? defaultStatus(data));
  const [priority, setPriority] = useState<Priority>(0);
  const [assigneeId, setAssigneeId] = useState<Id<"members"> | undefined>(defaults.assigneeId);
  const [labelIds, setLabelIds] = useState<Id<"labels">[]>([]);
  const [dueDate, setDueDate] = useState<string | undefined>();
  // A sub-issue always takes its parent's project.
  const [projectId, setProjectId] = useState<Id<"projects"> | undefined>(defaults.parent ? defaults.parent.projectId : defaults.projectId);
  const projects = data.projects.filter((row) => row.spaceId === space._id);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (submitting.current) return;
    if (!title.trim()) {
      setError("Give the issue a title.");
      return;
    }
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const created = await create({
        spaceId: space._id,
        ...(projectId && !defaults.parent ? { projectId } : {}),
        title,
        description: description.current?.getMarkdown() ?? "",
        statusId,
        priority,
        ...(assigneeId ? { assigneeId } : {}),
        labelIds,
        ...(dueDate ? { dueDate } : {}),
        ...(defaults.parent ? { parentId: defaults.parent._id } : {}),
      });
      onDone();
      toast(`Created ${created.key}`, {
        description: title.trim(),
        action: { label: "Open", onClick: () => navigate(routes.issue(created.key)) },
      });
    } catch (err) {
      setError(describeError(err, "Couldn't create the issue."));
      setPending(false);
      submitting.current = false;
    }
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          void submit();
        }
      }}
      className="flex flex-col"
    >
      <div className="flex items-center gap-1.5 px-4 pt-3.5 text-xs text-muted-foreground">
        <SpaceAvatar space={space} size="xs" />
        <span className="text-foreground">{space.name}</span>
        <ChevronRightIcon className="size-3" aria-hidden />
        {defaults.parent ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <span>Sub-issue of</span>
            <IssueKey value={defaults.parent.key} />
            <span className="truncate">{defaults.parent.title}</span>
          </span>
        ) : (
          <span>New issue</span>
        )}
      </div>
      <DialogTitle className="sr-only">{defaults.parent ? "New sub-issue" : "New issue"}</DialogTitle>
      <DialogDescription className="sr-only">
        Title, description and properties. Press Command or Control and Enter to create.
      </DialogDescription>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            description.current?.focus();
          }
        }}
        placeholder="Issue title"
        aria-label="Issue title"
        autoFocus
        maxLength={200}
        className="mx-4 mt-2 bg-transparent text-lg font-medium text-foreground outline-none placeholder:text-faint-foreground"
      />
      {/* Same height while the editor loads (only if C comes before the shell has preloaded it). */}
      <Suspense fallback={<div className="min-h-24" aria-busy="true" />}>
        <MarkdownEditor
          ref={description}
          value=""
          placeholder="Add a description… (markdown)"
          aria-label="Issue description"
          className="max-h-[45vh] overflow-y-auto"
          contentClassName="min-h-24 px-4 py-2"
        />
      </Suspense>
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-1 pb-3">
        <StatusPicker statuses={data.statuses} value={statusId} onChange={setStatusId} variant="chip" />
        <PriorityPicker value={priority} onChange={setPriority} variant="chip" />
        <AssigneePicker
          members={data.members}
          me={data.me}
          value={assigneeId}
          onChange={(id) => setAssigneeId(id ?? undefined)}
          variant="chip"
        />
        <LabelsPicker labels={data.labels} value={labelIds} onChange={setLabelIds} variant="chip" />
        <DueDatePicker value={dueDate} onChange={(day) => setDueDate(day ?? undefined)} variant="chip" />
        {(projects.length > 0 || projectId) && (
          <ProjectPicker
            projects={projects}
            value={projectId}
            onChange={(id) => setProjectId(id ?? undefined)}
            variant="chip"
            lockedReason={defaults.parent ? "Sub-issues are in their parent's project" : undefined}
          />
        )}
      </div>
      {error && (
        <div className="px-4 pb-3">
          <FormError message={error} />
        </div>
      )}
      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
        <span className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Keycap keys="mod+enter" /> to create
        </span>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : defaults.parent ? "Create sub-issue" : "Create issue"}
        </Button>
      </div>
    </form>
  );
}
