"use client";

import { api } from "@pantry/backend/api";
import type { Doc, Id } from "@pantry/backend/dataModel";
import { Button } from "@pantry/ui/components/button";
import { ColorPicker } from "@pantry/ui/components/color-picker";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import { resolveLabelColor } from "@pantry/ui/lib/issue-meta";
import { spring, useMotionTransition } from "@pantry/ui/lib/motion";
import { useMutation } from "convex/react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { InlineInput } from "../../components/inline-input";
import type { WorkspaceData } from "../../shell/app-shell";
import { describeError } from "../form-error";
import { SettingsGroup, SettingsPanel } from "./parts";

/** Category defaults, offered first in the colour picker (match lib/defaults.ts in the backend). */
const CATEGORY_DEFAULT: Record<Doc<"statuses">["category"], string> = {
  backlog: "#84868c",
  unstarted: "#9b9ea6",
  started: "#e5ae00",
  review: "#9172ee",
  done: "#29ac68",
  canceled: "#787a80",
};

/** The fixed category behind each status (what agents and "My issues" filter on). */
const CATEGORY_NAME: Record<Doc<"statuses">["category"], string> = {
  backlog: "Backlog",
  unstarted: "Unstarted",
  started: "Started",
  review: "Review",
  done: "Done",
  canceled: "Canceled",
};

export function StatusesSettings({ data }: { data: WorkspaceData }) {
  const update = useMutation(api.statuses.update);
  const reorder = useMutation(api.statuses.reorder);
  const transition = useMotionTransition(spring.smooth);
  const statuses = data.statuses;

  async function save(status: Doc<"statuses">, patch: { name?: string; color?: string }) {
    try {
      await update({ statusId: status._id, ...patch });
    } catch (err) {
      toast.error(describeError(err, "Couldn't update the status."));
    }
  }

  async function move(index: number, by: -1 | 1) {
    const ids: Id<"statuses">[] = statuses.map((status) => status._id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved!);
    try {
      await reorder({ statusIds: ids });
    } catch (err) {
      toast.error(describeError(err, "Couldn't reorder the statuses."));
    }
  }

  return (
    <SettingsPanel
      title="Statuses"
      description="Six statuses, one per category. Rename, recolour and reorder them; the order is the order of list groups and board columns."
    >
      <SettingsGroup title="Workflow">
        <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
          {statuses.map((status, index) => (
            <motion.li
              key={status._id}
              layout="position"
              transition={transition}
              className="flex min-h-row items-center gap-1.5 bg-background py-1 pr-1.5 pl-1.5 text-sm"
            >
              <ColorPicker
                label={`Colour of ${status.name}`}
                value={status.color}
                extra={[{ value: CATEGORY_DEFAULT[status.category], name: "Default" }]}
                onChange={(color) => void save(status, { color })}
              />
              <InlineInput
                value={status.name}
                aria-label={`Name of ${status.name}`}
                maxLength={40}
                onSave={(name) => save(status, { name })}
                className="h-7 flex-1"
              />
              <span className="flex w-24 shrink-0 items-center gap-1.5 text-xs text-muted-foreground" title="Category (fixed)">
                <StatusGlyph category={status.category} color={resolveLabelColor(status.color)} size={12} />
                {CATEGORY_NAME[status.category]}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Move ${status.name} up`}
                disabled={index === 0}
                onClick={() => void move(index, -1)}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Move ${status.name} down`}
                disabled={index === statuses.length - 1}
                onClick={() => void move(index, 1)}
              >
                <ArrowDownIcon />
              </Button>
            </motion.li>
          ))}
        </ol>
      </SettingsGroup>
    </SettingsPanel>
  );
}
