"use client";

import type { Doc, Id } from "@pantry/backend/dataModel";
import type { Project } from "@pantry/backend/model";
import { PersonAvatar } from "@pantry/ui/components/avatar-stack";
import { Button } from "@pantry/ui/components/button";
import {
  createDropdownMenuHandle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  type DropdownMenuHandle,
} from "@pantry/ui/components/dropdown-menu";
import { Input } from "@pantry/ui/components/input";
import { LabelChip } from "@pantry/ui/components/label-chip";
import {
  createPopoverHandle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  type PopoverHandle,
} from "@pantry/ui/components/popover";
import { PriorityGlyph } from "@pantry/ui/components/priority-glyph";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import { PRIORITY_LABEL, resolveLabelColor, type Priority } from "@pantry/ui/lib/issue-meta";
import { focusRing } from "@pantry/ui/lib/styles";
import { cn } from "@pantry/ui/lib/utils";
import { CalendarIcon, LayersIcon, TagIcon, UserRoundIcon } from "lucide-react";
import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { addDays, formatDay, today } from "../lib/format";
import { projectColor } from "../shell/space-color";
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
    variant === "full" &&
      "h-7 w-full min-w-0 justify-start gap-2 rounded-md px-2 text-sm text-foreground",
    variant === "chip" && "h-6 gap-1.5 border border-border px-2 text-xs text-foreground",
    className,
  );
}

const PRIORITY_ORDER: Priority[] = [0, 1, 2, 3, 4];

// ---------------------------------------------------------------------------------------------
// Shared menus for long lists
// ---------------------------------------------------------------------------------------------

/** What a row's trigger hands the shared menu: the row's current value and what to do with a pick. */
type RowPick<T, Next = T> = { key: string; value: T; onChange: (next: Next) => void };

type RowPickerHandles = {
  status: DropdownMenuHandle<RowPick<Id<"statuses">>>;
  priority: DropdownMenuHandle<RowPick<Priority>>;
  assignee: DropdownMenuHandle<RowPick<Id<"members"> | undefined, Id<"members"> | null>>;
  dueDate: PopoverHandle<RowPick<string | undefined, string | null>>;
};

const RowPickersContext = createContext<RowPickerHandles | null>(null);

/**
 * One status, priority, assignee and due-date menu for a whole list. Inside it, the rows' "icon"
 * pickers render only a trigger (Base UI detached triggers) that opens the shared menu with its
 * value and onChange; outside it they're complete pickers. A closed menu is ~10 components, so a
 * 600-row list rendered ~24,000 of them for menus nobody had opened.
 */
export function RowPickers({
  statuses,
  members,
  me,
  children,
}: {
  statuses: Doc<"statuses">[];
  members: Doc<"members">[];
  me: Doc<"members">;
  children: ReactNode;
}) {
  const [handles] = useState<RowPickerHandles>(() => ({
    status: createDropdownMenuHandle(),
    priority: createDropdownMenuHandle(),
    assignee: createDropdownMenuHandle(),
    dueDate: createPopoverHandle(),
  }));
  return (
    <RowPickersContext value={handles}>
      {children}
      <DropdownMenu handle={handles.status}>
        {({ payload }) =>
          payload && (
            <StatusMenu statuses={statuses} value={payload.value} onChange={payload.onChange} />
          )
        }
      </DropdownMenu>
      <DropdownMenu handle={handles.priority}>
        {({ payload }) =>
          payload && <PriorityMenu value={payload.value} onChange={payload.onChange} />
        }
      </DropdownMenu>
      <DropdownMenu handle={handles.assignee}>
        {({ payload }) =>
          payload && (
            <AssigneeMenu
              members={members}
              me={me}
              value={payload.value}
              onChange={payload.onChange}
              align="end"
            />
          )
        }
      </DropdownMenu>
      <Popover handle={handles.dueDate}>
        {({ payload }) =>
          payload && (
            // Keyed by the trigger: the date field starts from that row's date.
            <DueDateContent
              key={payload.key}
              value={payload.value}
              onChange={payload.onChange}
              close={() => handles.dueDate.close()}
            />
          )
        }
      </Popover>
    </RowPickersContext>
  );
}

// ---------------------------------------------------------------------------------------------

function StatusMenu({
  statuses,
  value,
  onChange,
}: {
  statuses: Doc<"statuses">[];
  value: Id<"statuses">;
  onChange: (statusId: Id<"statuses">) => void;
}) {
  return (
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
  );
}

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
  const shared = useContext(RowPickersContext);
  const key = useId();
  const current = statuses.find((status) => status._id === value);
  const trigger = {
    className: pickerTrigger(variant, className),
    "aria-label": `Status: ${current?.name ?? "unknown"}. Change status`,
    children: (
      <>
        {current && <StatusGlyph category={current.category} color={statusColor(current)} />}
        {variant !== "icon" && <span className="truncate">{current?.name}</span>}
      </>
    ),
  };
  if (shared && variant === "icon") {
    return (
      <DropdownMenuTrigger handle={shared.status} payload={{ key, value, onChange }} {...trigger} />
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger {...trigger} />
      <StatusMenu statuses={statuses} value={value} onChange={onChange} />
    </DropdownMenu>
  );
}

function PriorityMenu({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (priority: Priority) => void;
}) {
  return (
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
  const shared = useContext(RowPickersContext);
  const key = useId();
  const trigger = {
    className: pickerTrigger(variant, className),
    "aria-label": `Priority: ${PRIORITY_LABEL[value]}. Change priority`,
    children: (
      <>
        <PriorityGlyph priority={value} />
        {variant !== "icon" && (
          <span className={cn("truncate", value === 0 && "text-muted-foreground")}>
            {value === 0 && variant === "chip" ? "Priority" : PRIORITY_LABEL[value]}
          </span>
        )}
      </>
    ),
  };
  if (shared && variant === "icon") {
    return (
      <DropdownMenuTrigger
        handle={shared.priority}
        payload={{ key, value, onChange }}
        {...trigger}
      />
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger {...trigger} />
      <PriorityMenu value={value} onChange={onChange} />
    </DropdownMenu>
  );
}

function AssigneeMenu({
  members,
  me,
  value,
  onChange,
  align,
}: {
  members: Doc<"members">[];
  me: Doc<"members">;
  value: Id<"members"> | undefined;
  onChange: (memberId: Id<"members"> | null) => void;
  align: "start" | "end";
}) {
  const ordered = [me, ...members.filter((member) => member._id !== me._id)];
  return (
    <DropdownMenuContent className="w-52" align={align}>
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
              <PersonAvatar
                person={{ name: member.displayName, avatarUrl: member.avatarUrl }}
                size="xs"
              />
              <span className="truncate">
                {member.displayName}
                {member._id === me._id && <span className="text-muted-foreground"> (you)</span>}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
    </DropdownMenuContent>
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
  const shared = useContext(RowPickersContext);
  const key = useId();
  const current = members.find((member) => member._id === value);
  const trigger = {
    className: pickerTrigger(variant, className),
    "aria-label": `Assignee: ${current?.displayName ?? "none"}. Change assignee`,
    children: (
      <>
        {current ? (
          <PersonAvatar
            person={{ name: current.displayName, avatarUrl: current.avatarUrl }}
            size="xs"
          />
        ) : variant === "icon" ? (
          <span className="border-gray-8 size-5 rounded-full border border-dashed" aria-hidden />
        ) : (
          <UserRoundIcon className="text-muted-foreground size-3.5" aria-hidden />
        )}
        {variant !== "icon" && (
          <span className={cn("truncate", !current && "text-muted-foreground")}>
            {current?.displayName ?? (variant === "chip" ? "Assignee" : "No assignee")}
          </span>
        )}
      </>
    ),
  };
  if (shared && variant === "icon") {
    return (
      <DropdownMenuTrigger
        handle={shared.assignee}
        payload={{ key, value, onChange }}
        {...trigger}
      />
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger {...trigger} />
      <AssigneeMenu
        members={members}
        me={me}
        value={value}
        onChange={onChange}
        align={variant === "icon" ? "end" : "start"}
      />
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
        className={cn(
          pickerTrigger(variant, className),
          variant === "full" && "h-auto min-h-7 flex-wrap py-1",
        )}
        aria-label={`Labels: ${selected.map((label) => label.name).join(", ") || "none"}. Change labels`}
      >
        {selected.length === 0 ? (
          <>
            <TagIcon className="text-muted-foreground size-3.5" aria-hidden />
            <span className="text-muted-foreground">
              {variant === "chip" ? "Labels" : "No labels"}
            </span>
          </>
        ) : variant === "chip" ? (
          <>
            <span className="flex -space-x-0.5" aria-hidden>
              {selected.slice(0, 3).map((label) => (
                <span
                  key={label._id}
                  className="ring-background size-2 rounded-full ring-1"
                  style={{ background: resolveLabelColor(label.color) }}
                />
              ))}
            </span>
            {selected.length === 1 ? selected[0]!.name : `${selected.length} labels`}
          </>
        ) : (
          selected.map((label) => (
            <LabelChip key={label._id} name={label.name} color={label.color} />
          ))
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Labels</DropdownMenuLabel>
          {sorted.length === 0 && (
            <div className="text-muted-foreground px-2 py-1.5 text-sm">
              No labels yet. Add them in Settings.
            </div>
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
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: resolveLabelColor(label.color) }}
                aria-hidden
              />
              <span className="truncate">{label.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The due-date popup: a typed day, or one of the quick picks. `close` runs after a pick. */
function DueDateContent({
  value,
  onChange,
  close,
}: {
  value: string | undefined;
  onChange: (day: string | null) => void;
  close: () => void;
}) {
  const pick = (day: string | null) => {
    if ((day ?? undefined) !== value) onChange(day);
    close();
  };
  const commit = (day: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day >= "1970-01-01" && day !== value) pick(day);
  };
  return (
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
        <Button
          size="sm"
          variant="ghost"
          className="justify-start"
          onClick={() => pick(addDays(1))}
        >
          Tomorrow
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="justify-start"
          onClick={() => pick(addDays(7))}
        >
          In a week
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="justify-start"
          disabled={!value}
          onClick={() => pick(null)}
        >
          Clear
        </Button>
      </div>
    </PopoverContent>
  );
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
  const shared = useContext(RowPickersContext);
  const key = useId();
  const [open, setOpen] = useState(false);
  const overdue = value !== undefined && value < today();
  let label: ReactNode;
  if (value) {
    label = (
      <span className={cn("tabular font-mono text-xs", overdue && "text-destructive")}>
        {formatDay(value)}
      </span>
    );
  } else if (variant !== "icon") {
    label = (
      <span className="text-muted-foreground">
        {variant === "chip" ? "Due date" : "No due date"}
      </span>
    );
  }
  const trigger = {
    className: cn(pickerTrigger(variant, className), variant === "icon" && value && "w-auto px-1"),
    "aria-label": `Due date: ${value ? formatDay(value) : "none"}${overdue ? " (overdue)" : ""}. Change due date`,
    children: (
      <>
        {(variant !== "icon" || !value) && (
          <CalendarIcon
            className={cn("size-3.5", value ? "text-muted-foreground" : "text-faint-foreground")}
            aria-hidden
          />
        )}
        {label}
      </>
    ),
  };
  if (shared && variant === "icon") {
    return (
      <PopoverTrigger handle={shared.dueDate} payload={{ key, value, onChange }} {...trigger} />
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger {...trigger} />
      <DueDateContent value={value} onChange={onChange} close={() => setOpen(false)} />
    </Popover>
  );
}

/**
 * The issue's project inside its space, or none. Sub-issues can't pick their own (they follow the
 * parent), so the picker shows the parent's and explains why it's fixed.
 */
export function ProjectPicker({
  projects,
  value,
  onChange,
  variant = "full",
  className,
  lockedReason,
}: {
  projects: Project[];
  value: Id<"projects"> | undefined;
  onChange: (projectId: Id<"projects"> | null) => void;
  variant?: Exclude<PickerVariant, "icon">;
  className?: string;
  /** Shown instead of the menu (e.g. "Set by the parent issue"). */
  lockedReason?: string;
}) {
  const current = projects.find((project) => project._id === value);
  const label = (
    <>
      {current ? (
        <span
          className="size-2 shrink-0 rounded-[2px]"
          style={{ background: projectColor(current) }}
          aria-hidden
        />
      ) : (
        <LayersIcon className="text-muted-foreground size-3.5" aria-hidden />
      )}
      <span className={cn("truncate", !current && "text-muted-foreground")}>
        {current?.name ?? (variant === "chip" ? "Project" : "No project")}
      </span>
    </>
  );
  if (lockedReason) {
    return (
      <span
        className={cn(pickerTrigger(variant, className), "hover:bg-transparent")}
        title={lockedReason}
      >
        {label}
      </span>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={pickerTrigger(variant, className)}
        aria-label={`Project: ${current?.name ?? "none"}. Change project`}
      >
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Project</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value ?? "none"}
            onValueChange={(next) => {
              const projectId = next === "none" ? null : (next as Id<"projects">);
              if ((projectId ?? undefined) !== value) onChange(projectId);
            }}
          >
            <DropdownMenuRadioItem value="none" closeOnClick>
              <LayersIcon />
              No project
            </DropdownMenuRadioItem>
            {projects.map((project) => (
              <DropdownMenuRadioItem key={project._id} value={project._id} closeOnClick>
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ background: projectColor(project) }}
                  aria-hidden
                />
                <span className="truncate">{project.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {projects.length === 0 && (
            <div className="text-muted-foreground px-2 py-1.5 text-xs">
              No projects in this space yet. Add them in space settings.
            </div>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
