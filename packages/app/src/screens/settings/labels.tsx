"use client";

import { api } from "@pantry/backend/api";
import type { Doc } from "@pantry/backend/dataModel";
import { Button } from "@pantry/ui/components/button";
import { ColorPicker } from "@pantry/ui/components/color-picker";
import { Input } from "@pantry/ui/components/input";
import { LABEL_COLORS } from "@pantry/ui/lib/issue-meta";
import { useMutation } from "convex/react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { InlineInput } from "../../components/inline-input";
import type { WorkspaceData } from "../../shell/app-shell";
import { describeError, FormError } from "../form-error";
import { SettingsEmpty, SettingsGroup, SettingsList, SettingsPanel, SettingsRow } from "./parts";

/** Next palette colour that no label uses yet, so new labels don't all start the same. */
function nextColor(labels: Doc<"labels">[]): string {
  const used = new Set(labels.map((label) => label.color));
  return LABEL_COLORS.find((color) => color !== "gray" && !used.has(color)) ?? "gray";
}

export function LabelsSettings({ data }: { data: WorkspaceData }) {
  const update = useMutation(api.labels.update);
  const [removing, setRemoving] = useState<Doc<"labels"> | null>(null);
  const remove = useMutation(api.labels.remove);
  const sorted = [...data.labels].sort((a, b) => a.name.localeCompare(b.name));

  async function save(label: Doc<"labels">, patch: { name?: string; color?: string }) {
    try {
      await update({ labelId: label._id, ...patch });
    } catch (err) {
      toast.error(describeError(err, "Couldn't update the label."));
    }
  }

  return (
    <SettingsPanel
      title="Labels"
      description="Shared by every project. Agents add and remove labels by name over MCP; they never create new ones."
    >
      <NewLabel labels={data.labels} />
      <SettingsGroup
        title="Labels"
        hint={<span className="tabular font-mono">{data.labels.length}</span>}
      >
        {sorted.length === 0 ? (
          <SettingsEmpty>No labels yet.</SettingsEmpty>
        ) : (
          <SettingsList>
            {sorted.map((label) => (
              <SettingsRow key={label._id} className="gap-1.5 pr-1.5 pl-1.5">
                <ColorPicker
                  label={`Colour of ${label.name}`}
                  value={label.color}
                  onChange={(color) => void save(label, { color })}
                />
                <InlineInput
                  value={label.name}
                  aria-label={`Name of ${label.name}`}
                  maxLength={40}
                  onSave={(name) => save(label, { name })}
                  className="h-7 flex-1"
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Delete ${label.name}`}
                  onClick={() => setRemoving(label)}
                >
                  <Trash2Icon />
                </Button>
              </SettingsRow>
            ))}
          </SettingsList>
        )}
      </SettingsGroup>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Delete ${removing?.name ?? "label"}?`}
        description="It's removed from every issue that has it. This can't be undone."
        confirmLabel="Delete label"
        destructive
        onConfirm={async () => {
          if (!removing) return;
          try {
            await remove({ labelId: removing._id });
            toast(`Deleted ${removing.name}`);
          } catch (err) {
            toast.error(describeError(err, "Couldn't delete the label."));
          }
        }}
      />
    </SettingsPanel>
  );
}

function NewLabel({ labels }: { labels: Doc<"labels">[] }) {
  const create = useMutation(api.labels.create);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shownColor = color ?? nextColor(labels);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await create({ name, color: shownColor });
      setName("");
      setColor(null);
    } catch (err) {
      setError(describeError(err, "Couldn't create the label."));
    }
  }

  return (
    <SettingsGroup title="New label">
      <form onSubmit={onSubmit} className="flex items-center gap-1.5">
        <ColorPicker label="Colour of the new label" value={shownColor} onChange={setColor} />
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Bug"
          aria-label="New label name"
          maxLength={40}
          className="flex-1"
        />
        <Button type="submit" variant="secondary" disabled={!name.trim()} data-icon="inline-start">
          <PlusIcon />
          Add label
        </Button>
      </form>
      <FormError message={error} />
    </SettingsGroup>
  );
}
