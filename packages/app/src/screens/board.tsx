"use client";

import {
  closestCenter,
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  KeyboardCode,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import type { Doc, Id } from "@pantry/backend/dataModel";
import { PersonAvatar } from "@pantry/ui/components/avatar-stack";
import { Button } from "@pantry/ui/components/button";
import { IssueKey } from "@pantry/ui/components/issue-key";
import { LabelChip } from "@pantry/ui/components/label-chip";
import { PriorityGlyph } from "@pantry/ui/components/priority-glyph";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import { duration, ease, spring, usePrefersReducedMotion } from "@pantry/ui/lib/motion";
import { cn } from "@pantry/ui/lib/utils";
import { motion } from "motion/react";
import { CornerDownRightIcon, PlusIcon } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { EntryGate } from "../entry";
import { useIssueActions } from "../issues/actions";
import { statusColor, type Lookups } from "../issues/lookups";
import { SubIssueProgress } from "../issues/sub-issue-progress";
import { formatDay, today } from "../lib/format";
import { routes, useNavigation } from "../navigation";
import { AppShell } from "../shell/app-shell";
import { NotMemberScreen } from "./not-member";
import { ProjectIssues, useIssueFamily, type BoardProps } from "./project";
import { ProjectNotFound, ProjectTitle } from "./project-chrome";

/** A project's board (spec §4): a column per status, drag to move. */
export function BoardPage({ projectKey }: { projectKey: string }) {
  return (
    <EntryGate allow={["ready", "not-member"]}>
      {(state) =>
        state.kind === "not-member" ? (
          <NotMemberScreen />
        ) : (
          <AppShell title={(data) => <ProjectTitle data={data} projectKey={projectKey} view="board" />}>
            {(data) => {
              const project = data.projects.find((p) => p.key === projectKey);
              if (!project) return <ProjectNotFound projectKey={projectKey} />;
              return (
                <ProjectIssues
                  key={project._id}
                  data={data}
                  project={project}
                  view="board"
                  renderBoard={(props) => <Board {...props} />}
                />
              );
            }}
          </AppShell>
        )
      }
    </EntryGate>
  );
}

/** Where a dragged card would land: a status column and an index among the other cards. */
type Target = { statusId: Id<"statuses">; index: number };
/** A drop waiting for the server: shown in place so the card doesn't jump back meanwhile. */
type PendingMove = Target & { issueId: Id<"issues"> };

const columnId = (statusId: Id<"statuses">) => `column:${statusId}`;

/** Pointer first (precise), nearest centre for the keyboard sensor (no pointer). */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : closestCenter(args);
};

function Board({ issues, lookups, newIssue }: BoardProps) {
  const actions = useIssueActions();
  const family = useIssueFamily(issues);
  const reduceMotion = usePrefersReducedMotion();
  const statuses = lookups.data.statuses;
  const [activeId, setActiveId] = useState<Id<"issues"> | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);
  const justDropped = useRef(0);

  // Columns in server order, with a pending drop applied on top.
  const columns = useMemo(() => {
    const byStatus = new Map<Id<"statuses">, Doc<"issues">[]>(statuses.map((status) => [status._id, []]));
    for (const issue of issues) {
      if (pending && issue._id === pending.issueId) continue;
      byStatus.get(issue.statusId)?.push(issue);
    }
    const moved = pending && issues.find((issue) => issue._id === pending.issueId);
    if (pending && moved) byStatus.get(pending.statusId)?.splice(pending.index, 0, moved);
    return byStatus;
  }, [issues, statuses, pending]);

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so clicks still open the issue.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Space picks a card up and drops it; Enter stays free to open the issue.
    useSensor(KeyboardSensor, {
      keyboardCodes: {
        start: [KeyboardCode.Space],
        cancel: [KeyboardCode.Esc],
        end: [KeyboardCode.Space, KeyboardCode.Enter],
      },
    }),
  );

  const issueById = (id: unknown) => issues.find((issue) => issue._id === id);
  const statusName = (id: Id<"statuses"> | undefined) => statuses.find((status) => status._id === id)?.name ?? "";

  /** Column + index for the dragged card's current position (its centre against the card under it). */
  function locate(event: DragMoveEvent): Target | null {
    const { active, over } = event;
    if (!over) return null;
    const dragged = active.rect.current.translated;
    const centerY = dragged ? dragged.top + dragged.height / 2 : 0;
    const overData = over.data.current as { statusId: Id<"statuses"> } | undefined;
    if (!overData) return null;
    const column = columns.get(overData.statusId) ?? [];
    // Over its own slot: stay put.
    if (over.id === active.id) return { statusId: overData.statusId, index: column.findIndex((issue) => issue._id === active.id) };
    const others = column.filter((issue) => issue._id !== active.id);
    if (String(over.id).startsWith("column:")) return { statusId: overData.statusId, index: others.length };
    const index = others.findIndex((issue) => issue._id === over.id);
    if (index < 0) return { statusId: overData.statusId, index: others.length };
    const below = centerY > over.rect.top + over.rect.height / 2;
    return { statusId: overData.statusId, index: index + (below ? 1 : 0) };
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as Id<"issues">);
  }

  function onDragMove(event: DragMoveEvent) {
    const next = locate(event);
    setTarget((current) =>
      current?.statusId === next?.statusId && current?.index === next?.index ? current : next,
    );
  }

  function onDragEnd(event: DragEndEvent) {
    const issue = issueById(event.active.id);
    const drop = target;
    setActiveId(null);
    setTarget(null);
    justDropped.current = Date.now();
    if (!issue || !drop) return;

    const others = (columns.get(drop.statusId) ?? []).filter((row) => row._id !== issue._id);
    const sameColumn = drop.statusId === issue.statusId;
    const currentIndex = (columns.get(issue.statusId) ?? []).findIndex((row) => row._id === issue._id);
    if (sameColumn && currentIndex === drop.index) return;

    const afterId = others[drop.index - 1]?._id;
    const beforeId = others[drop.index]?._id;
    setPending({ issueId: issue._id, ...drop });
    void actions
      .move(issue._id, drop.statusId, { ...(afterId ? { afterId } : {}), ...(beforeId ? { beforeId } : {}) })
      .finally(() => setPending((current) => (current?.issueId === issue._id ? null : current)));
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${issueById(active.id)?.key ?? "issue"}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${issueById(active.id)?.key ?? "Issue"} is over ${statusName((over.data.current as { statusId: Id<"statuses"> }).statusId)}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${issueById(active.id)?.key ?? "issue"} in ${statusName((over.data.current as { statusId: Id<"statuses"> }).statusId)}.`
        : `Dropped ${issueById(active.id)?.key ?? "issue"}.`,
    onDragCancel: ({ active }) => `Moving ${issueById(active.id)?.key ?? "issue"} was cancelled.`,
  };

  // The lifted card settles into its slot on the standard duration and entrance ease; with reduced
  // motion it's placed at once.
  const dropAnimation: DropAnimation | null = reduceMotion
    ? null
    : {
        duration: duration.standard * 1000,
        easing: `cubic-bezier(${ease.out.join(", ")})`,
        sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
      };

  const active = activeId ? issueById(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setTarget(null);
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "Press Space to pick the issue up, the arrow keys to move it and Space to drop it; Escape cancels. Enter opens the issue.",
        },
      }}
    >
      <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto p-2">
        {statuses.map((status) => (
          <Column
            key={status._id}
            status={status}
            issues={columns.get(status._id) ?? []}
            activeId={activeId}
            indicator={target?.statusId === status._id ? target.index : null}
            onNewIssue={() => newIssue({ statusId: status._id })}
          >
            {(issue) => (
              <Card
                issue={issue}
                lookups={lookups}
                parentKey={issue.parentId ? family.byId.get(issue.parentId)?.key : undefined}
                subIssues={family.children.get(issue._id)}
                dimmed={issue._id === activeId}
                justDropped={justDropped}
              />
            )}
          </Column>
        ))}
      </div>
      <DragOverlay dropAnimation={dropAnimation}>
        {active ? (
          <motion.div
            initial={reduceMotion ? false : { scale: 1, rotate: 0 }}
            animate={reduceMotion ? undefined : { scale: 1.02, rotate: -1 }}
            transition={spring.snappy}
            className="cursor-grabbing"
          >
            <CardBody
              issue={active}
              lookups={lookups}
              parentKey={active.parentId ? family.byId.get(active.parentId)?.key : undefined}
              subIssues={family.children.get(active._id)}
              lifted
            />
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  issues,
  activeId,
  indicator,
  onNewIssue,
  children,
}: {
  status: Doc<"statuses">;
  issues: Doc<"issues">[];
  activeId: Id<"issues"> | null;
  indicator: number | null;
  onNewIssue: () => void;
  children: (issue: Doc<"issues">) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status._id), data: { statusId: status._id } });
  // The indicator index counts the other cards, so skip the dragged one when placing it.
  const others = issues.filter((issue) => issue._id !== activeId);
  const indicatorBefore = indicator !== null ? (others[indicator]?._id ?? "end") : null;
  return (
    <section
      aria-label={status.name}
      className={cn(
        "flex w-68 shrink-0 flex-col rounded-lg bg-gray-2 transition-colors duration-(--duration-instant)",
        isOver && "bg-gray-3",
      )}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 px-3">
        <StatusGlyph category={status.category} color={statusColor(status)} />
        <h2 className="font-sans text-sm font-medium tracking-normal text-foreground">{status.name}</h2>
        <span className="font-mono text-xs text-muted-foreground tabular">{issues.length}</span>
        <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label={`New issue in ${status.name}`} onClick={onNewIssue}>
          <PlusIcon />
        </Button>
      </div>
      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {issues.map((issue) => (
          <div key={issue._id} className="relative">
            {indicatorBefore === issue._id && <DropIndicator />}
            {children(issue)}
          </div>
        ))}
        {indicatorBefore === "end" && (
          <div className="relative">
            <DropIndicator />
          </div>
        )}
      </div>
    </section>
  );
}

/** Where the card will land: a line in the gap above the card, so nothing shifts while you drag. */
function DropIndicator() {
  return <div aria-hidden className="pointer-events-none absolute inset-x-1 -top-[5px] z-10 h-0.5 rounded-full bg-foreground" />;
}

function Card({
  issue,
  lookups,
  parentKey,
  subIssues,
  dimmed,
  justDropped,
}: {
  issue: Doc<"issues">;
  lookups: Lookups;
  parentKey?: string;
  subIssues?: Doc<"issues">[];
  dimmed: boolean;
  justDropped: React.RefObject<number>;
}) {
  const { Link, navigate } = useNavigation();
  const reduceMotion = usePrefersReducedMotion();
  const draggable = useDraggable({ id: issue._id, data: { statusId: issue.statusId } });
  const { onKeyDown, ...listeners } = draggable.listeners ?? {};
  const droppable = useDroppable({ id: issue._id, data: { statusId: issue.statusId } });
  return (
    <motion.div
      ref={(node) => {
        draggable.setNodeRef(node);
        droppable.setNodeRef(node);
      }}
      // Cards slide to their new place when the order changes (here or in another browser).
      layout={reduceMotion ? false : "position"}
      transition={spring.smooth}
      data-issue-id={issue._id}
      className={cn("touch-none rounded-md outline-none", dimmed && "opacity-40")}
      {...draggable.attributes}
      {...listeners}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === "Enter" && !event.defaultPrevented && !draggable.isDragging) navigate(routes.issue(issue.key));
      }}
      aria-roledescription="draggable issue"
      aria-label={`${issue.key} ${issue.title}`}
    >
      <CardBody issue={issue} lookups={lookups} parentKey={parentKey} subIssues={subIssues}>
        <Link
          href={routes.issue(issue.key)}
          tabIndex={-1}
          aria-hidden
          draggable={false}
          onClick={(event) => {
            // A drop ends with a click on whatever is under the pointer: don't open it.
            if (Date.now() - justDropped.current < 250) event.preventDefault();
          }}
          className="absolute inset-0 rounded-md"
        />
      </CardBody>
    </motion.div>
  );
}

function CardBody({
  issue,
  lookups,
  parentKey,
  subIssues,
  lifted = false,
  children,
}: {
  issue: Doc<"issues">;
  lookups: Lookups;
  parentKey?: string;
  subIssues?: Doc<"issues">[];
  lifted?: boolean;
  children?: ReactNode;
}) {
  const assignee = lookups.member(issue.assigneeId);
  const labels = issue.labelIds.map(lookups.label).filter((label) => label !== undefined);
  const overdue = issue.dueDate !== undefined && issue.dueDate < today();
  return (
    <div
      className={cn(
        "relative flex cursor-default flex-col gap-2 rounded-md bg-background p-2.5 shadow-raised dark:bg-gray-3",
        "transition-[box-shadow] duration-(--duration-instant) hover:shadow-[0_0_0_1px_var(--border-strong),0_1px_2px_oklch(0_0_0/0.06)]",
        lifted && "shadow-overlay hover:shadow-overlay",
      )}
    >
      {children}
      <div className="flex items-center gap-2">
        <IssueKey value={issue.key} />
        {parentKey && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground" title={`Sub-issue of ${parentKey}`}>
            <CornerDownRightIcon className="size-3" aria-hidden />
            <span className="font-mono">{parentKey}</span>
          </span>
        )}
        <span className="ml-auto">
          {assignee ? (
            <PersonAvatar person={{ name: assignee.displayName, avatarUrl: assignee.avatarUrl }} size="xs" />
          ) : (
            <span className="block size-4 rounded-full border border-dashed border-gray-8" aria-label="Unassigned" />
          )}
        </span>
      </div>
      <span className="line-clamp-2 text-sm leading-5 text-foreground">{issue.title}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex h-5 items-center rounded-sm border border-border px-1">
          <PriorityGlyph priority={issue.priority} size={12} />
        </span>
        {labels.map((label) => (
          <LabelChip key={label._id} name={label.name} color={label.color} />
        ))}
        {issue.dueDate && (
          <span
            className={cn(
              "flex h-5 items-center rounded-sm border border-border px-1.5 font-mono text-2xs tabular",
              overdue ? "text-destructive" : "text-muted-foreground",
            )}
            title={overdue ? "Overdue" : "Due"}
          >
            {formatDay(issue.dueDate)}
          </span>
        )}
        {subIssues && subIssues.length > 0 && <SubIssueProgress subIssues={subIssues} />}
      </div>
    </div>
  );
}
