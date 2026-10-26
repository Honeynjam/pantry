"use client";

import { api } from "@pantry/backend/api";
import type { Doc } from "@pantry/backend/dataModel";
import type { Project } from "@pantry/backend/model";
import { Button } from "@pantry/ui/components/button";
import { IssueKey } from "@pantry/ui/components/issue-key";
import { Keycap } from "@pantry/ui/components/keycap";
import { useMutation, useQuery } from "convex/react";
import { ColorPicker } from "@pantry/ui/components/color-picker";
import { Input } from "@pantry/ui/components/input";
import { SegmentedControl } from "@pantry/ui/components/segmented-control";
import { LABEL_COLORS } from "@pantry/ui/lib/issue-meta";
import { PantryAvatarPicker } from "@pantry/ui/components/pantry-avatar-picker";
import type { PantryAvatarValue } from "@pantry/ui/lib/pantry-avatars";
import { ArchiveIcon, ArrowDownIcon, ArrowUpIcon, PlusIcon } from "lucide-react";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { MarkdownEditor, preloadMarkdownEditor } from "../components/markdown-editor";
import { ConfirmDialog } from "../components/confirm-dialog";
import { InlineInput } from "../components/inline-input";
import { SpaceAvatar, spaceAvatar } from "../components/space-avatar";
import { EntryGate } from "../entry";
import { fullDate, timeAgo } from "../lib/format";
import { routes, useNavigation } from "../navigation";
import { AppShell } from "../shell/app-shell";
import { describeError } from "./form-error";
import { NotMemberScreen } from "./not-member";
import { SpaceNotFound, SpaceTitle } from "./space-chrome";
import { SettingsEmpty, SettingsGroup, SettingsList, SettingsPanel, SettingsRow } from "./settings/parts";

/** Space settings (spec §4): name, avatar, key, kind, projects, context doc, archive. */
export function SpaceSettingsPage({ spaceKey }: { spaceKey: string }) {
  return (
    <EntryGate allow={["ready", "not-member"]}>
      {(state) =>
        state.kind === "not-member" ? (
          <NotMemberScreen />
        ) : (
          <AppShell title={(data) => <SpaceTitle data={data} spaceKey={spaceKey} view="settings" />}>
            {(data) => {
              const space = data.spaces.find((row) => row.key === spaceKey);
              if (!space) return <SpaceNotFound spaceKey={spaceKey} />;
              return (
                <div className="flex flex-1 justify-center overflow-y-auto px-6 py-8 md:px-10">
                  <SpaceSettings space={space} projects={data.projects.filter((row) => row.spaceId === space._id)} />
                </div>
              );
            }}
          </AppShell>
        )
      }
    </EntryGate>
  );
}

function SpaceSettings({ space, projects }: { space: Doc<"spaces">; projects: Project[] }) {
  const update = useMutation(api.spaces.update);
  const archive = useMutation(api.spaces.archive);
  const saveAvatar = useMutation(api.spaces.setAvatar);
  // Shown at once while the save is in flight, so clicking through looks feels instant.
  const [pendingAvatar, setPendingAvatar] = useState<PantryAvatarValue | null>(null);
  const { navigate } = useNavigation();
  const [archiving, setArchiving] = useState(false);
  const save = async (patch: { name?: string; kind?: "product" | "client" }) => {
    try {
      await update({ spaceId: space._id, ...patch });
    } catch (err) {
      toast.error(describeError(err, "Couldn't save the space."));
    }
  };

  return (
    <SettingsPanel
      title="Space settings"
      description={
        <span className="inline-flex items-center gap-1.5">
          <SpaceAvatar space={space} size="xs" />
          {space.name}
        </span>
      }
    >
      <SettingsGroup title="Details">
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          <div className="flex min-h-row items-center gap-3 py-1 pr-1.5 pl-3 text-sm">
            <label htmlFor="space-name" className="w-24 shrink-0 text-muted-foreground">
              Name
            </label>
            <InlineInput
              id="space-name"
              value={space.name}
              maxLength={80}
              className="h-7 flex-1"
              onSave={(name) => save({ name })}
            />
          </div>
          <div className="flex min-h-row items-center gap-3 py-1 pr-1.5 pl-3 text-sm">
            <span className="w-24 shrink-0 text-muted-foreground">Avatar</span>
            <PantryAvatarPicker
              value={pendingAvatar ?? spaceAvatar(space)}
              seed={space.key}
              label="Space avatar"
              className="-my-0.5 -ml-1"
              onChange={async (avatar) => {
                setPendingAvatar(avatar);
                try {
                  await saveAvatar({ spaceId: space._id, avatar });
                } catch (err) {
                  toast.error(describeError(err, "Couldn't change the avatar."));
                } finally {
                  setPendingAvatar((shown) => (shown === avatar ? null : shown));
                }
              }}
            />
          </div>
          <div className="flex min-h-row items-center gap-3 px-3 py-1.5 text-sm">
            <span className="w-24 shrink-0 text-muted-foreground">Kind</span>
            <SegmentedControl
              size="sm"
              aria-label="Kind"
              value={space.kind ?? "product"}
              onValueChange={(kind) => void save({ kind })}
              options={[
                { value: "product", label: "Product" },
                { value: "client", label: "Client" },
              ]}
            />
            <span className="text-xs text-muted-foreground">One of your products, or client work.</span>
          </div>
          <div className="flex min-h-row items-center gap-3 px-3 py-1 text-sm">
            <span className="w-24 shrink-0 text-muted-foreground">Key</span>
            <IssueKey value={space.key} className="text-foreground" />
            <span className="text-xs text-muted-foreground">
              Fixed: issues are {space.key}-1, {space.key}-2, … and agents refer to them by key.
            </span>
          </div>
        </div>
      </SettingsGroup>
      <ProjectsSettings space={space} projects={projects} />
      <ContextDoc space={space} />
      <SettingsGroup title="Archive">
        <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
          <p className="flex-1 text-sm text-muted-foreground">
            Hides the space from the sidebar. Its issues and key are kept.
          </p>
          <Button variant="secondary" onClick={() => setArchiving(true)} data-icon="inline-start">
            <ArchiveIcon />
            Archive space
          </Button>
        </div>
      </SettingsGroup>
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={`Archive ${space.name}?`}
        description={`It disappears from the sidebar and space lists. Its issues keep their ${space.key} keys.`}
        confirmLabel="Archive space"
        onConfirm={async () => {
          try {
            await archive({ spaceId: space._id });
            toast(`Archived ${space.name}`);
            navigate(routes.home);
          } catch (err) {
            toast.error(describeError(err, "Couldn't archive the space."));
          }
        }}
      />
    </SettingsPanel>
  );
}

const PROJECT_COLORS = LABEL_COLORS.filter((color) => color !== "gray");

/**
 * The space's projects: optional workstreams ("LinkedIn", "Launch"). Add, rename, recolour,
 * reorder (arrow buttons, so it works from the keyboard) and archive. Archiving keeps the issues
 * in the space with no project.
 */
function ProjectsSettings({ space, projects }: { space: Doc<"spaces">; projects: Project[] }) {
  const create = useMutation(api.projects.create);
  const update = useMutation(api.projects.update);
  const reorder = useMutation(api.projects.reorder);
  const archive = useMutation(api.projects.archive);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<Project | null>(null);
  const shownColor = color ?? PROJECT_COLORS[projects.length % PROJECT_COLORS.length]!;
  const run = async (action: () => Promise<unknown>, failure: string) => {
    try {
      await action();
    } catch (err) {
      toast.error(describeError(err, failure));
    }
  };
  const move = (index: number, step: -1 | 1) => {
    const ids = projects.map((project) => project._id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + step, 0, moved!);
    void run(() => reorder({ spaceId: space._id, projectIds: ids }), "Couldn't reorder the projects.");
  };

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await create({ spaceId: space._id, name, color: shownColor });
      setName("");
      setColor(null);
    } catch (err) {
      toast.error(describeError(err, "Couldn't add the project."));
    }
  }

  return (
    <SettingsGroup
      title="Projects"
      hint="Optional workstreams in this space. An issue is in at most one."
      className="scroll-mt-8"
    >
      <div id="projects" className="flex flex-col gap-2">
        {projects.length === 0 ? (
          <SettingsEmpty>No projects yet. Issues can live in the space without one.</SettingsEmpty>
        ) : (
          <SettingsList>
            {projects.map((project, index) => (
              <SettingsRow key={project._id}>
                <ColorPicker
                  label={`Colour of ${project.name}`}
                  value={project.color ?? "gray"}
                  onChange={(next) => void run(() => update({ projectId: project._id, color: next }), "Couldn't recolour the project.")}
                />
                <InlineInput
                  value={project.name}
                  aria-label={`Name of ${project.name}`}
                  maxLength={60}
                  className="h-7 flex-1"
                  onSave={(next) => run(() => update({ projectId: project._id, name: next }), "Couldn't rename the project.")}
                />
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Move ${project.name} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Move ${project.name} down`}
                  disabled={index === projects.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon />
                </Button>
                <Button size="icon-xs" variant="ghost" aria-label={`Archive ${project.name}`} onClick={() => setArchiving(project)}>
                  <ArchiveIcon />
                </Button>
              </SettingsRow>
            ))}
          </SettingsList>
        )}
        <form onSubmit={add} className="flex items-center gap-2">
          <ColorPicker label="Colour of the new project" value={shownColor} onChange={setColor} />
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Launch, Marketing, LinkedIn"
            aria-label="New project name"
            maxLength={60}
            className="flex-1"
          />
          <Button type="submit" variant="secondary" disabled={!name.trim()} data-icon="inline-start">
            <PlusIcon />
            Add project
          </Button>
        </form>
      </div>
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={`Archive ${archiving?.name ?? "project"}?`}
        description="Its issues stay in the space with no project, and each gets an activity entry."
        confirmLabel="Archive project"
        onConfirm={async () => {
          if (!archiving) return;
          await run(() => archive({ projectId: archiving._id }), "Couldn't archive the project.");
          toast(`Archived ${archiving.name}`);
        }}
      />
    </SettingsGroup>
  );
}

function ContextDoc({ space }: { space: Doc<"spaces"> }) {
  useEffect(preloadMarkdownEditor, []);
  const doc = useQuery(api.docs.getContext, { spaceId: space._id });
  const save = useMutation(api.docs.saveContext);
  const [saving, setSaving] = useState(false);

  return (
    <SettingsGroup
      title="Context doc"
      hint="Agents read this first (MCP get_space_context)."
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
          <Suspense fallback={<div className="h-48" aria-busy="true" />}>
            <MarkdownEditor
              value={doc?.body ?? ""}
              aria-label={`${space.name} context doc`}
              placeholder="What agents should know before working in this space…"
              contentClassName="min-h-48 px-4 py-3"
              onSave={async (body) => {
                setSaving(true);
                try {
                  await save({ spaceId: space._id, body });
                } catch (err) {
                  toast.error(describeError(err, "Couldn't save the context doc."));
                } finally {
                  setSaving(false);
                }
              }}
            />
          </Suspense>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Markdown. Saves when you click away or press <Keycap keys="mod+enter" />.
      </p>
    </SettingsGroup>
  );
}
