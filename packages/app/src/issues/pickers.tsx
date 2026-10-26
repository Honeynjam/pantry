"use client";

import type { Doc, Id } from "@pantry/backend/dataModel";
import { PersonAvatar } from "@pantry/ui/components/avatar-stack";
import { Button } from "@pantry/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@pantry/ui/components/dropdown-menu";
import { Input } from "@pantry/ui/components/input";
import { LabelChip } from "@pantry/ui/components/label-chip";
import { Popover, PopoverContent, PopoverTrigger } from "@pantry/ui/components/popover";
import { PriorityGlyph } from "@pantry/ui/components/priority-glyph";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import { PRIORITY_LABEL, resolveLabelColor, type Priority } from "@pantry/ui/lib/issue-meta";
import { focusRing } from "@pantry/ui/lib/styles";
import { cn } from "@pantry/ui/lib/utils";
import { CalendarIcon, TagIcon, UserRoundIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { formatDay, today } from "../lib/format";
import { statusColor } from "./lookups";

/**
 * Property pickers shared by list rows ("icon": a 24px glyph button), the issue's properties panel
 * and the new-issue dialog ("full": glyph + text). Menus are Base UI, so they're keyboard-driven.
 */
export type PickerVariant = "icon" | "full" | "chip";

const triggerBase = cn(
  "relative z-10 inline-flex shrink-0 cursor-default items-center rounded-sm outline-none transition-colors duration-(--duration-instant)",
  "hover:bg-accent aria-expanded:bg-accent",
  focusRing,
);

export function pickerTrigger(variant: PickerVariant, className?: string) {
  return cn(
    triggerBase,
    variant === "icon" && "size-6 justify-center",
    variant === "full" && "h-7 w-full min-w-0 justify-start gap-2 rounded-md px-2 text-sm text-foreground",
    variant === "chip" && "h-6 gap-1.5 border border-border px-2 text-xs text-foreground",
    className,
  );
}

const PRIORITY_ORDER: Priority[] = [0, 1, 2, 3, 4];

// ---------------------------------------------------------------------------------------------

export function StatusPicker({
  statuses,
  value,
  onChange,
  variant = "icon",
  className,
}: {
  statuses: Doc<"statuses">[];
  value: Id<"statuses">;
  onChange: (statusId: Id<"statuses">) => void;
  variant?: PickerVariant;
  className?: string;
}) {
  const current = statuses.find((status) => status._id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={pickerTrigger(variant, className)}
        aria-label={`Status: ${current?.name ?? "unknown"}. Change status`}
      >
        {current && <StatusGlyph category={current.category} color={statusColor(current)} />}
        {variant !== "icon" && <span className="truncate">{current?.name}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(next) => next !== value && onChange(next as Id<"statuses">)}
          >
            {statuses.map((status) => (
              <DropdownMenuRadioItem key={status._id} value={status._id} closeOnClick>
                <StatusGlyph category={status.category} color={statusColor(status)} />
                {status.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PriorityPicker({
  value,
  onChange,
  variant = "icon",
  className,
}: {
  value: Priority;
  onChange: (priority: Priority) => void;
  variant?: PickerVariant;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={pickerTrigger(variant, className)}
        aria-label={`Priority: ${PRIORITY_LABEL[value]}. Change priority`}
      >
        <PriorityGlyph priority={value} />
        {variant !== "icon" && (
          <span className={cn("truncate", value === 0 && "text-muted-foreground")}>
            {value === 0 && variant === "chip" ? "Priority" : PRIORITY_LABEL[value]}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Priority</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={String(value)}
            onValueChange={(next) => Number(next) !== value && onChange(Number(next) as Priority)}
          >
            {PRIORITY_ORDER.map((priority) => (
              <DropdownMenuRadioItem key={priority} value={String(priority)} closeOnClick>
                <PriorityGlyph priority={priority} />
                {PRIORITY_LABEL[priority]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AssigneePicker({
  members,
  me,
  value,
  onChange,
  variant = "icon",
  className,
}: {
  members: Doc<"members">[];
  me: Doc<"members">;
  value: Id<"members"> | undefined;
  onChange: (memberId: Id<"members"> | null) => void;
  variant?: PickerVariant;
  className?: string;
}) {
  const current = members.find((member) => member._id === value);
  const ordered = [me, ...members.filter((member) => member._id !== me._id)];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={pickerTrigger(variant, className)}
        aria-label={`Assignee: ${current?.displayName ?? "none"}. Change assignee`}
      >
        {current ? (
          <PersonAvatar person={{ name: current.displayName, avatarUrl: current.avatarUrl }} size="xs" />
        ) : variant === "icon" ? (
          <span className="size-5 rounded-full border border-dashed border-gray-8" aria-hidden />
        ) : (
          <UserRoundIcon className="size-3.5 text-muted-foreground" aria-hidden />
        )}
        {variant !== "icon" && (
          <span className={cn("truncate", !current && "text-muted-foreground")}>
            {current?.displayName ?? (variant === "chip" ? "Assignee" : "No assignee")}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52" align={variant === "icon" ? "end" : "start"}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Assignee</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value ?? "none"}
            onValueChange={(next) => {
              const memberId = next === "none" ? null : (next as Id<"members">);
              if ((memberId ?? undefined) !== value) onChange(memberId);
            }}
          >
            <DropdownMenuRadioItem value="none" closeOnClick>
              <UserRoundIcon />
              No assignee
            </DropdownMenuRadioItem>
            {ordered.map((member) => (
              <DropdownMenuRadioItem key={member._id} value={member._id} closeOnClick>
                <PersonAvatar person={{ name: member.displayName, avatarUrl: member.avatarUrl }} size="xs" />
                <span className="truncate">
                  {member.displayName}
                  {member._id === me._id && <span className="text-muted-foreground"> (you)</span>}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LabelsPicker({
  labels,
  value,
  onChange,
  variant = "full",
  className,
}: {
  labels: Doc<"labels">[];
  value: Id<"labels">[];
  onChange: (labelIds: Id<"labels">[]) => void;
  variant?: Exclude<PickerVariant, "icon">;
  className?: string;
}) {
  const selected = labels.filter((label) => value.includes(label._id));
  const sorted = [...labels].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(pickerTrigger(variant, className), variant === "full" && "h-auto min-h-7 flex-wrap py-1")}
        aria-label={`Labels: ${selected.map((label) => label.name).join(", ") || "none"}. Change labels`}
      >
        {selected.length === 0 ? (
          <>
            <TagIcon className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">{variant === "chip" ? "Labels" : "No labels"}</span>
          </>
        ) : variant === "chip" ? (
          <>
            <span className="flex -space-x-0.5" aria-hidden>
              {selected.slice(0, 3).map((label) => (
                <span
                  key={label._id}
                  className="size-2 rounded-full ring-1 ring-background"
                  style={{ background: resolveLabelColor(label.color) }}
                />
              ))}
            </span>
            {selected.length === 1 ? selected[0]!.name : `${selected.length} labels`}
          </>
        ) : (
          selected.map((label) => <LabelChip key={label._id} name={label.name} color={label.color} />)
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Labels</DropdownMenuLabel>
          {sorted.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No labels yet. Add them in Settings.</div>
          )}
          {sorted.map((label) => (
            <DropdownMenuCheckboxItem
              key={label._id}
              checked={value.includes(label._id)}
              closeOnClick={false}
              onCheckedChange={(checked) =>
                onChange(checked ? [...value, label._id] : value.filter((id) => id !== label._id))
              }
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: resolveLabelColor(label.color) }} aria-hidden />
              <span className="truncate">{label.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Due date: a day, no time. Overdue dates read in the destructive colour (with the date as text). */
export function DueDatePicker({
  value,
  onChange,
  variant = "full",
  className,
}: {
  value: string | undefined;
  onChange: (day: string | null) => void;
  variant?: PickerVariant;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const overdue = value !== undefined && value < today();
  const pick = (day: string | null) => {
    if ((day ?? undefined) !== value) onChange(day);
    setOpen(false);
  };
  const commit = (day: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day >= "1970-01-01" && day !== value) pick(day);
  };
  let label: ReactNode;
  if (value) {
    label = <span className={cn("font-mono text-xs tabular", overdue && "text-destructive")}>{formatDay(value)}</span>;
  } else if (variant !== "icon") {
    label = <span className="text-muted-foreground">{variant === "chip" ? "Due date" : "No due date"}</span>;
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(pickerTrigger(variant, className), variant === "icon" && value && "w-auto px-1")}
        aria-label={`Due date: ${value ? formatDay(value) : "none"}${overdue ? " (overdue)" : ""}. Change due date`}
      >
        {(variant !== "icon" || !value) && (
          <CalendarIcon className={cn("size-3.5", value ? "text-muted-foreground" : "text-faint-foreground")} aria-hidden />
        )}
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 gap-2 p-2">
        <Input
          type="date"
          aria-label="Due date"
          defaultValue={value}
          // Commit on Enter or when leaving the field: while a year is typed the input already
          // reports dates like 0002-10-28.
          onKeyDown={(event) => {
            if (event.key === "Enter") commit(event.currentTarget.value);
          }}
          onBlur={(event) => commit(event.currentTarget.value)}
          className="font-mono"
        />
        <div className="grid grid-cols-2 gap-1">
          <Button size="sm" variant="ghost" className="justify-start" onClick={() => pick(today())}>
            Today
          </Button>
          <Button size="sm" variant="ghost" className="justify-start" onClick={() => pick(addDays(1))}>
            Tomorrow
          </Button>
          <Button size="sm" variant="ghost" className="justify-start" onClick={() => pick(addDays(7))}>
            In a week
          </Button>
          <Button size="sm" variant="ghost" className="justify-start" disabled={!value} onClick={() => pick(null)}>
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
