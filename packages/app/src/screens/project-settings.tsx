"use client";

import { api } from "@pantry/backend/api";
import type { Doc } from "@pantry/backend/dataModel";
import { Button } from "@pantry/ui/components/button";
import { IssueKey } from "@pantry/ui/components/issue-key";
import { Keycap } from "@pantry/ui/components/keycap";
import { MarkdownEditor } from "@pantry/ui/components/markdown-editor";
import { useMutation, useQuery } from "convex/react";
import { ArchiveIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "../components/confirm-dialog";
import { InlineInput } from "../components/inline-input";
import { EntryGate } from "../entry";
import { fullDate, timeAgo } from "../lib/format";
import { routes, useNavigation } from "../navigation";
import { AppShell } from "../shell/app-shell";
import { projectColor } from "../shell/project-color";
import { describeError } from "./form-error";
import { NotMemberScreen } from "./not-member";
import { ProjectNotFound, ProjectTitle } from "./project-chrome";
import { SettingsGroup, SettingsPanel } from "./settings/parts";

/** Project settings (spec §4): name, key, context doc, archive. */
export function ProjectSettingsPage({ projectKey }: { projectKey: string }) {
  return (
    <EntryGate allow={["ready", "not-member"]}>
      {(state) =>
        state.kind === "not-member" ? (
          <NotMemberScreen />
        ) : (
          <AppShell title={(data) => <ProjectTitle data={data} projectKey={projectKey} view="settings" />}>
            {(data) => {
              const project = data.projects.find((p) => p.key === projectKey);
              if (!project) return <ProjectNotFound projectKey={projectKey} />;
              return (
                <div className="flex flex-1 justify-center overflow-y-auto px-6 py-8 md:px-10">
                  <ProjectSettings project={project} />
                </div>
              );
            }}
          </AppShell>
        )
      }
    </EntryGate>
  );
}

function ProjectSettings({ project }: { project: Doc<"projects"> }) {
  const rename = useMutation(api.projects.update);
  const archive = useMutation(api.projects.archive);
  const { navigate } = useNavigation();
  const [archiving, setArchiving] = useState(false);

  return (
    <SettingsPanel
      title="Project settings"
      description={
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: projectColor(project.key) }} aria-hidden />
          {project.name}
        </span>
      }
    >
      <SettingsGroup title="Details">
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          <div className="flex min-h-row items-center gap-3 py-1 pr-1.5 pl-3 text-sm">
            <label htmlFor="project-name" className="w-24 shrink-0 text-muted-foreground">
              Name
            </label>
            <InlineInput
              id="project-name"
              value={project.name}
              maxLength={80}
              className="h-7 flex-1"
              onSave={async (name) => {
                try {
                  await rename({ projectId: project._id, name });
                } catch (err) {
                  toast.error(describeError(err, "Couldn't rename the project."));
                }
              }}
            />
          </div>
          <div className="flex min-h-row items-center gap-3 px-3 py-1 text-sm">
            <span className="w-24 shrink-0 text-muted-foreground">Key</span>
            <IssueKey value={project.key} className="text-foreground" />
            <span className="text-xs text-muted-foreground">
              Fixed: issues are {project.key}-1, {project.key}-2, … and agents refer to them by key.
            </span>
          </div>
        </div>
      </SettingsGroup>
      <ContextDoc project={project} />
      <SettingsGroup title="Archive">
        <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
          <p className="flex-1 text-sm text-muted-foreground">
            Hides the project from the sidebar. Its issues and key are kept.
          </p>
          <Button variant="secondary" onClick={() => setArchiving(true)} data-icon="inline-start">
            <ArchiveIcon />
            Archive project
          </Button>
        </div>
      </SettingsGroup>
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={`Archive ${project.name}?`}
        description={`It disappears from the sidebar and project lists. Its issues keep their ${project.key} keys.`}
        confirmLabel="Archive project"
        onConfirm={async () => {
          try {
            await archive({ projectId: project._id });
            toast(`Archived ${project.name}`);
            navigate(routes.home);
          } catch (err) {
            toast.error(describeError(err, "Couldn't archive the project."));
          }
        }}
      />
    </SettingsPanel>
  );
}

function ContextDoc({ project }: { project: Doc<"projects"> }) {
  const doc = useQuery(api.docs.getContext, { projectId: project._id });
  const save = useMutation(api.docs.saveContext);
  const [saving, setSaving] = useState(false);

  return (
    <SettingsGroup
      title="Context doc"
      hint="Agents read this first (MCP get_project_context)."
      actions={
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          {saving ? (
            "Saving…"
          ) : doc ? (
            <span title={fullDate(doc.updatedAt)}>
              Edited {timeAgo(doc.updatedAt)}
              {doc.updatedBy ? ` by ${doc.updatedBy.displayName}` : ""}
            </span>
          ) : null}
        </span>
      }
    >
      <div className="rounded-lg border border-border transition-colors duration-(--duration-instant) focus-within:border-border-strong">
        {doc === undefined ? (
          <div className="h-48" aria-busy="true" />
        ) : (
          <MarkdownEditor
            value={doc?.body ?? ""}
            aria-label={`${project.name} context doc`}
            placeholder="What agents should know before working on this project…"
            contentClassName="min-h-48 px-4 py-3"
            onSave={async (body) => {
              setSaving(true);
              try {
                await save({ projectId: project._id, body });
              } catch (err) {
                toast.error(describeError(err, "Couldn't save the context doc."));
              } finally {
                setSaving(false);
              }
            }}
          />
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Markdown. Saves when you click away or press <Keycap keys="mod+enter" />.
      </p>
    </SettingsGroup>
  );
}
