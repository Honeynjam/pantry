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
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import type { Doc, Id } from "@pantry/backend/dataModel";
import { PersonAvatar } from "@pantry/ui/components/avatar-stack";
import { Button } from "@pantry/ui/components/button";
import { Checkbox } from "@pantry/ui/components/checkbox";
import { IssueKey } from "@pantry/ui/components/issue-key";
import { LabelChip } from "@pantry/ui/components/label-chip";
import { ProjectChip } from "@pantry/ui/components/project-chip";
import { PriorityGlyph } from "@pantry/ui/components/priority-glyph";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import { duration, ease, spring, usePrefersReducedMotion } from "@pantry/ui/lib/motion";
import { cn } from "@pantry/ui/lib/utils";
import { motion } from "motion/react";
import { CornerDownRightIcon, LayersIcon, PlusIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { EntryGate } from "../entry";
import { useIssueActions } from "../issues/actions";
import { statusColor, type Lookups } from "../issues/lookups";
import { SelectionProvider, useIssueSelection, useSelection } from "../issues/selection";
import { SubIssueProgress } from "../issues/sub-issue-progress";
import { formatDay, today } from "../lib/format";
import { routes, useNavigation } from "../navigation";
import { AppShell } from "../shell/app-shell";
import { projectColor } from "../shell/space-color";
import { NotMemberScreen } from "./not-member";
import { SpaceIssues, useIssueFamily, type BoardProps } from "./space";
import { SpaceNotFound, SpaceTitle } from "./space-chrome";

/** A space's board (spec §4): a column per status, drag to move; optional project swimlanes. */
export function BoardPage({ spaceKey }: { spaceKey: string }) {
  return (
    <EntryGate allow={["ready", "not-member"]}>
      {(state) =>
        state.kind === "not-member" ? (
          <NotMemberScreen />
        ) : (
          <AppShell title={(data) => <SpaceTitle data={data} spaceKey={spaceKey} view="board" />}>
            {(data) => {
              const space = data.spaces.find((row) => row.key === spaceKey);
              if (!space) return <SpaceNotFound spaceKey={spaceKey} />;
              return (
                <SpaceIssues
                  key={space._id}
                  data={data}
                  space={space}
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

/**
 * A swimlane: one per project of the space plus "none" when grouped by project, else one "all".
 * Every column and card carries its lane, so a drop knows its project as well as its status.
 */
type Lane = { id: string; project: Doc<"projects"> | null | undefined };

/** Where a dragged card would land: a lane, a status column and an index among the other cards. */
type Target = { lane: string; statusId: Id<"statuses">; index: number };
type DropData = { lane: string; statusId: Id<"statuses"> };

const columnId = (lane: string, statusId: Id<"statuses">) => `column:${lane}:${statusId}`;
const cellKey = (lane: string, statusId: Id<"statuses">) => `${lane}:${statusId}`;

/**
 * The card under the pointer wins over the column that contains it (pointerWithin returns both, in
 * no useful order); the column alone means the empty space below its cards. The keyboard sensor has
 * no pointer, so it falls back to the nearest centre.
 */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const cards = hits.filter((hit) => !String(hit.id).startsWith("column:"));
  if (cards.length > 0) return cards;
  return hits.length > 0 ? hits : closestCenter(args);
};

function Board({ issues, lookups, space, newIssue, groupBy }: BoardProps) {
  const actions = useIssueActions();
  const family = useIssueFamily(issues);
  const reduceMotion = usePrefersReducedMotion();
  const statuses = lookups.data.statuses;
  const [activeId, setActiveId] = useState<Id<"issues"> | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const justDropped = useRef(0);
  const container = useRef<HTMLDivElement>(null);

  const projects = lookups.projectsOf(space._id);
  const lanes = useMemo<Lane[]>(
    () =>
      groupBy === "project"
        ? [...projects.map((project) => ({ id: project._id as string, project })), { id: "none", project: null }]
        : [{ id: "all", project: undefined }],
    [groupBy, projects],
  );
  const laneOf = useCallback(
    (issue: Doc<"issues">) =>
      groupBy !== "project" ? "all" : issue.projectId && projects.some((p) => p._id === issue.projectId) ? issue.projectId : "none",
    [groupBy, projects],
  );

  // Cells in list order. A drop shows at once: issues.move/update are optimistic, so `issues`
  // already has the card in its new place (and Convex puts it back if the server refuses).
  const columns = useMemo(() => {
    const cells = new Map<string, Doc<"issues">[]>();
    for (const lane of lanes) for (const status of statuses) cells.set(cellKey(lane.id, status._id), []);
    for (const issue of issues) cells.get(cellKey(laneOf(issue), issue.statusId))?.push(issue);
    return cells;
  }, [issues, statuses, lanes, laneOf]);
  const cell = (lane: string, statusId: Id<"statuses">) => columns.get(cellKey(lane, statusId)) ?? [];

  // J/K walk the board lane by lane, column by column, top to bottom.
  const ordered = useMemo(
    () => lanes.flatMap((lane) => statuses.flatMap((status) => columns.get(cellKey(lane.id, status._id)) ?? [])),
    [lanes, statuses, columns],
  );
  const selection = useIssueSelection({ ordered, lookups, actions, container });

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
  function locate(event: DragMoveEvent | DragOverEvent | DragEndEvent): Target | null {
    const { active, over } = event;
    if (!over) return null;
    const dragged = active.rect.current.translated;
    const centerY = dragged ? dragged.top + dragged.height / 2 : 0;
    const overData = over.data.current as DropData | undefined;
    if (!overData) return null;
    const { lane, statusId } = overData;
    const column = cell(lane, statusId);
    // Over its own slot: stay put.
    if (over.id === active.id) return { lane, statusId, index: column.findIndex((issue) => issue._id === active.id) };
    const others = column.filter((issue) => issue._id !== active.id);
    if (String(over.id).startsWith("column:")) return { lane, statusId, index: others.length };
    const index = others.findIndex((issue) => issue._id === over.id);
    if (index < 0) return { lane, statusId, index: others.length };
    const below = centerY > over.rect.top + over.rect.height / 2;
    return { lane, statusId, index: index + (below ? 1 : 0) };
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as Id<"issues">);
  }

  // `over` on move events can lag a step behind the pointer, so over-changes update it too and the
  // drop is located again from the final event.
  function onDragMove(event: DragMoveEvent | DragOverEvent) {
    const next = locate(event);
    setTarget((current) =>
      current?.lane === next?.lane && current?.statusId === next?.statusId && current?.index === next?.index ? current : next,
    );
  }

  function onDragEnd(event: DragEndEvent) {
    const issue = issueById(event.active.id);
    // Dropped outside every column: nothing moves.
    const drop = event.over ? locate(event) : null;
    setActiveId(null);
    setTarget(null);
    justDropped.current = Date.now();
    if (!issue || !drop) return;

    const fromLane = laneOf(issue);
    if (drop.lane !== fromLane) {
      // Into another project's lane: the project changes too. Sub-issues follow their parent.
      if (issue.parentId) {
        toast("Sub-issues are in their parent's project", { description: "Move the parent issue to another project instead." });
        return;
      }
      void actions.update(issue._id, { projectId: drop.lane === "none" ? null : (drop.lane as Id<"projects">) });
    }
    const others = cell(drop.lane, drop.statusId).filter((row) => row._id !== issue._id);
    const sameColumn = drop.statusId === issue.statusId && drop.lane === fromLane;
    const currentIndex = cell(fromLane, issue.statusId).findIndex((row) => row._id === issue._id);
    if (sameColumn && currentIndex === drop.index) return;
    if (drop.lane !== fromLane && drop.statusId === issue.statusId && others.length === 0) return;

    const afterId = others[drop.index - 1]?._id;
    const beforeId = others[drop.index]?._id;
    void actions.move(issue._id, drop.statusId, { ...(afterId ? { afterId } : {}), ...(beforeId ? { beforeId } : {}) });
  }

  const place = (data: unknown) => {
    const { lane, statusId } = data as DropData;
    const project = lanes.find((row) => row.id === lane)?.project;
    return project === undefined ? statusName(statusId) : `${statusName(statusId)}, ${project?.name ?? "no project"}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${issueById(active.id)?.key ?? "issue"}.`,
    onDragOver: ({ active, over }) => (over ? `${issueById(active.id)?.key ?? "Issue"} is over ${place(over.data.current)}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over ? `Dropped ${issueById(active.id)?.key ?? "issue"} in ${place(over.data.current)}.` : `Dropped ${issueById(active.id)?.key ?? "issue"}.`,
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
  const renderCard = (lane: string) =>
    function render(issue: Doc<"issues">) {
      return (
        <Card
          issue={issue}
          lane={lane}
          lookups={lookups}
          parentKey={issue.parentId ? family.byId.get(issue.parentId)?.key : undefined}
          subIssues={family.children.get(issue._id)}
          dimmed={issue._id === activeId}
          justDropped={justDropped}
        />
      );
    };

  return (
    <SelectionProvider value={selection.value}>
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragOver={onDragMove}
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
      {groupBy === "project" ? (
        <div ref={container} className="min-h-0 flex-1 overflow-auto px-2 pb-2">
          {/* Status headers once, above every lane. */}
          <div className="sticky top-0 z-20 flex w-max gap-2 bg-background pt-2 pb-1">
            {statuses.map((status) => (
              <ColumnHeader
                key={status._id}
                status={status}
                count={lanes.reduce((sum, lane) => sum + cell(lane.id, status._id).length, 0)}
                onNewIssue={() => newIssue({ statusId: status._id })}
                className="w-68 rounded-lg bg-gray-2"
              />
            ))}
          </div>
          {lanes.map((lane) => {
            const name = lane.project?.name ?? "No project";
            const count = statuses.reduce((sum, status) => sum + cell(lane.id, status._id).length, 0);
            return (
              <section key={lane.id} aria-label={name} className="mt-2">
                <div className="sticky left-0 flex h-8 w-fit items-center gap-2 px-1">
                  {lane.project ? (
                    <span className="size-2.5 rounded-[3px]" style={{ background: projectColor(lane.project) }} aria-hidden />
                  ) : (
                    <LayersIcon className="size-3.5 text-muted-foreground" aria-hidden />
                  )}
                  <h2 className="font-sans text-sm font-medium tracking-normal text-foreground">{name}</h2>
                  <span className="font-mono text-xs text-muted-foreground tabular">{count}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`New issue in ${name}`}
                    onClick={() => newIssue(lane.project ? { projectId: lane.project._id } : {})}
                  >
                    <PlusIcon />
                  </Button>
                </div>
                <div className="flex w-max gap-2">
                  {statuses.map((status) => (
                    <Column
                      key={status._id}
                      lane={lane.id}
                      laneName={name}
                      status={status}
                      issues={cell(lane.id, status._id)}
                      activeId={activeId}
                      indicator={target?.lane === lane.id && target.statusId === status._id ? target.index : null}
                      onNewIssue={() => newIssue({ statusId: status._id, ...(lane.project ? { projectId: lane.project._id } : {}) })}
                      header={false}
                    >
                      {renderCard(lane.id)}
                    </Column>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div ref={container} className="flex min-h-0 flex-1 gap-2 overflow-x-auto p-2">
          {statuses.map((status) => (
            <Column
              key={status._id}
              lane="all"
              status={status}
              issues={cell("all", status._id)}
              activeId={activeId}
              indicator={target?.statusId === status._id ? target.index : null}
              onNewIssue={() => newIssue({ statusId: status._id })}
            >
              {renderCard("all")}
            </Column>
          ))}
        </div>
      )}
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
    {selection.element}
    </SelectionProvider>
  );
}

function ColumnHeader({
  status,
  count,
  onNewIssue,
  className,
}: {
  status: Doc<"statuses">;
  count: number;
  onNewIssue: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex h-9 shrink-0 items-center gap-2 px-3", className)}>
      <StatusGlyph category={status.category} color={statusColor(status)} />
      <h2 className="font-sans text-sm font-medium tracking-normal text-foreground">{status.name}</h2>
      <span className="font-mono text-xs text-muted-foreground tabular">{count}</span>
      <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label={`New issue in ${status.name}`} onClick={onNewIssue}>
        <PlusIcon />
      </Button>
    </div>
  );
}

function Column({
  lane,
  laneName,
  status,
  issues,
  activeId,
  indicator,
  onNewIssue,
  header = true,
  children,
}: {
  lane: string;
  laneName?: string;
  status: Doc<"statuses">;
  issues: Doc<"issues">[];
  activeId: Id<"issues"> | null;
  indicator: number | null;
  onNewIssue: () => void;
  /** Swimlanes show the status headers once, above the lanes. */
  header?: boolean;
  children: (issue: Doc<"issues">) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(lane, status._id), data: { lane, statusId: status._id } });
  // The indicator index counts the other cards, so skip the dragged one when placing it.
  const others = issues.filter((issue) => issue._id !== activeId);
  const indicatorBefore = indicator !== null ? (others[indicator]?._id ?? "end") : null;
  return (
    <section
      aria-label={laneName ? `${laneName}, ${status.name}` : status.name}
      className={cn(
        "flex w-68 shrink-0 flex-col rounded-lg bg-gray-2 transition-colors duration-(--duration-instant)",
        isOver && "bg-gray-3",
      )}
    >
      {header && <ColumnHeader status={status} count={issues.length} onNewIssue={onNewIssue} />}
      <div
        ref={setNodeRef}
        className={cn("flex flex-col gap-2 px-2 pb-2", header ? "min-h-24 flex-1 overflow-y-auto" : "min-h-16 pt-2")}
      >
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
  lane,
  lookups,
  parentKey,
  subIssues,
  dimmed,
  justDropped,
}: {
  issue: Doc<"issues">;
  lane: string;
  lookups: Lookups;
  parentKey?: string;
  subIssues?: Doc<"issues">[];
  dimmed: boolean;
  justDropped: React.RefObject<number>;
}) {
  const { Link, navigate } = useNavigation();
  const reduceMotion = usePrefersReducedMotion();
  const selection = useSelection();
  const isCursor = selection?.cursor === issue._id;
  const isSelected = selection?.selected.has(issue._id) ?? false;
  const anySelected = (selection?.selected.size ?? 0) > 0;
  const draggable = useDraggable({ id: issue._id, data: { lane, statusId: issue.statusId } });
  const { onKeyDown, ...listeners } = draggable.listeners ?? {};
  const droppable = useDroppable({ id: issue._id, data: { lane, statusId: issue.statusId } });
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
      data-cursor={isCursor || undefined}
      data-selected={isSelected || undefined}
      className={cn(
        "group/card touch-none rounded-md",
        // The cursor: a ring that follows J/K (and keyboard focus).
        isCursor ? "outline-2 outline-offset-1 outline-ring outline-solid" : "outline-none",
        dimmed && "opacity-40",
      )}
      {...draggable.attributes}
      {...listeners}
      onFocus={() => selection?.setCursor(issue._id)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === "Enter" && !event.defaultPrevented && !draggable.isDragging) navigate(routes.issue(issue.key));
      }}
      aria-roledescription="draggable issue"
      aria-label={`${issue.key} ${issue.title}`}
    >
      <CardBody
        issue={issue}
        lookups={lookups}
        parentKey={parentKey}
        subIssues={subIssues}
        selected={isSelected}
        // Cards are dense: the box only takes room once something is selected (X starts it).
        select={
          selection && anySelected ? (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => selection.toggle(issue._id)}
              onPointerDown={(event) => event.stopPropagation()}
              tabIndex={-1}
              aria-label={`Select ${issue.key}`}
              className="relative z-10"
            />
          ) : null
        }
      >
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
  selected = false,
  select,
  children,
}: {
  issue: Doc<"issues">;
  lookups: Lookups;
  parentKey?: string;
  subIssues?: Doc<"issues">[];
  lifted?: boolean;
  selected?: boolean;
  /** The multi-select checkbox, before the key. */
  select?: ReactNode;
  children?: ReactNode;
}) {
  const assignee = lookups.member(issue.assigneeId);
  const labels = issue.labelIds.map(lookups.label).filter((label) => label !== undefined);
  const project = lookups.project(issue.projectId);
  const overdue = issue.dueDate !== undefined && issue.dueDate < today();
  return (
    <div
      className={cn(
        "relative flex cursor-default flex-col gap-2 rounded-md bg-background p-2.5 shadow-raised dark:bg-gray-3",
        "transition-[box-shadow] duration-(--duration-instant) hover:shadow-[0_0_0_1px_var(--border-strong),0_1px_2px_oklch(0_0_0/0.06)]",
        lifted && "shadow-overlay hover:shadow-overlay",
        selected && "bg-gray-3 dark:bg-gray-5",
      )}
    >
      {children}
      <div className="flex items-center gap-2">
        {select}
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
        {project && <ProjectChip name={project.name} color={project.color} title={`Project: ${project.name}`} />}
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
