"use client";

import { PersonAvatar } from "@pantry/ui/components/avatar-stack";
import { Button } from "@pantry/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@pantry/ui/components/dropdown-menu";
import { Kbd } from "@pantry/ui/components/kbd";
import { PriorityGlyph } from "@pantry/ui/components/priority-glyph";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import { PRIORITIES, PRIORITY_LABEL, resolveLabelColor } from "@pantry/ui/lib/issue-meta";
import { focusRing } from "@pantry/ui/lib/styles";
import { cn } from "@pantry/ui/lib/utils";
import type { Project } from "@pantry/backend/model";
import { ChevronDownIcon, LayersIcon, SearchIcon, UserRoundIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigation } from "../navigation";
import { useShortcut, useShortcutScope } from "../use-shortcuts";
import {
  EMPTY_FILTERS,
  hasFilters,
  parseFilters,
  serializeFilters,
  toggleValue,
  type AssigneeFilter,
  slug,
  type FilterFacet,
  type Filters,
} from "./filters";
import { projectColor } from "../shell/space-color";
import { statusColor, type Lookups } from "./lookups";

const URL_DEBOUNCE_MS = 250;

/**
 * Filters from the URL, with the title text applied as you type (the URL catches up a moment
 * later, so typing doesn't push a navigation per key).
 */
export function useIssueFilters() {
  const { pathname, search, navigate } = useNavigation();
  const fromUrl = useMemo(() => parseFilters(search), [search]);
  const [draft, setDraft] = useState(fromUrl.q);
  // The title text we last put in the URL. A URL change we didn't make (back/forward, a link)
  // replaces the draft; our own debounced write doesn't, so typing on isn't cut short.
  const [written, setWritten] = useState(fromUrl.q);
  const [seenSearch, setSeenSearch] = useState(search);
  if (seenSearch !== search) {
    setSeenSearch(search);
    if (fromUrl.q !== written) {
      setWritten(fromUrl.q);
      setDraft(fromUrl.q);
    }
  }

  const write = useCallback(
    (next: Filters) => {
      setWritten(next.q);
      const target = pathname + serializeFilters(next, search);
      if (target !== pathname + search) navigate(target, { replace: true });
    },
    [pathname, search, navigate],
  );

  useEffect(() => {
    if (draft.trim() === fromUrl.q.trim()) return;
    const timer = setTimeout(() => write({ ...fromUrl, q: draft.trim() }), URL_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, fromUrl, write]);

  const filters = useMemo(() => ({ ...fromUrl, q: draft }), [fromUrl, draft]);
  const setFilters = useCallback(
    (next: Filters) => {
      setDraft(next.q);
      write({ ...next, q: next.q.trim() });
    },
    [write],
  );
  return { filters, setFilters, setTitle: setDraft };
}

/**
 * The filter bar above the list and board: a title filter (`/`) and one menu per facet. Active
 * facets read as chips ("Priority: Urgent") with their own clear button.
 */
export function FilterBar({
  filters,
  setFilters,
  setTitle,
  lookups,
  facets = ["status", "assignee", "label", "priority"],
  projects = [],
}: {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  setTitle: (text: string) => void;
  lookups: Lookups;
  facets?: FilterFacet[];
  /** The space's projects, for the project facet. */
  projects?: Project[];
}) {
  const input = useRef<HTMLInputElement>(null);
  useShortcutScope("list");
  useShortcut("search", "list", () => {
    input.current?.focus();
    input.current?.select();
  });
  const { data } = lookups;
  const toggle = <F extends FilterFacet>(facet: F, value: Filters[F][number]) => setFilters(toggleValue(filters, facet, value));
  const clearFacet = (facet: FilterFacet) => setFilters({ ...filters, [facet]: [] });

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1" role="group" aria-label="Filters">
      <label
        className={cn(
          "flex h-control-sm w-44 items-center gap-1.5 rounded-sm px-2 text-xs transition-colors duration-(--duration-instant)",
          "text-muted-foreground hover:bg-accent focus-within:bg-accent",
          filters.q.trim() && "bg-accent text-foreground",
        )}
      >
        <SearchIcon className="size-3.5 shrink-0" aria-hidden />
        <input
          ref={input}
          value={filters.q}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              // Esc clears the text first, then leaves the field (back to J/K).
              if (filters.q) setTitle("");
              else event.currentTarget.blur();
            } else if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          placeholder="Filter by title"
          aria-label="Filter by title"
          aria-keyshortcuts="/"
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
        {filters.q ? (
          <button
            type="button"
            aria-label="Clear the title filter"
            onClick={() => setTitle("")}
            className={cn("flex size-4 items-center justify-center rounded-sm hover:text-foreground", focusRing)}
          >
            <XIcon className="size-3" />
          </button>
        ) : (
          <Kbd aria-hidden>/</Kbd>
        )}
      </label>

      {facets.includes("status") && (
        <Facet
          label="Status"
          active={filters.status.length}
          summary={summary(filters.status.map((value) => data.statuses.find((row) => slug(row.name) === value)?.name))}
          onClear={() => clearFacet("status")}
        >
          {data.statuses.map((status) => (
            <DropdownMenuCheckboxItem
              key={status._id}
              checked={filters.status.includes(slug(status.name))}
              onCheckedChange={() => toggle("status", slug(status.name))}
              closeOnClick={false}
            >
              <StatusGlyph category={status.category} color={statusColor(status)} />
              {status.name}
            </DropdownMenuCheckboxItem>
          ))}
        </Facet>
      )}

      {facets.includes("assignee") && (
        <Facet
          label="Assignee"
          active={filters.assignee.length}
          summary={summary(
            filters.assignee.map((value) =>
              value === "me" ? "Me" : value === "none" ? "No assignee" : data.members.find((row) => row._id === value)?.displayName,
            ),
          )}
          onClear={() => clearFacet("assignee")}
        >
          {(
            [
              { value: "me", name: "Me", icon: <PersonAvatar person={{ name: data.me.displayName, avatarUrl: data.me.avatarUrl }} size="xs" /> },
              { value: "none", name: "No assignee", icon: <UserRoundIcon /> },
              ...data.members
                .filter((member) => member._id !== data.me._id)
                .map((member) => ({
                  value: member._id as AssigneeFilter,
                  name: member.displayName,
                  icon: <PersonAvatar person={{ name: member.displayName, avatarUrl: member.avatarUrl }} size="xs" />,
                })),
            ] satisfies { value: AssigneeFilter; name: string; icon: ReactNode }[]
          ).map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={filters.assignee.includes(option.value)}
              onCheckedChange={() => toggle("assignee", option.value)}
              closeOnClick={false}
            >
              {option.icon}
              <span className="truncate">{option.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </Facet>
      )}

      {facets.includes("label") && (
        <Facet
          label="Label"
          active={filters.label.length}
          summary={summary(filters.label.map((value) => data.labels.find((row) => slug(row.name) === value)?.name))}
          onClear={() => clearFacet("label")}
        >
          {data.labels.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">No labels yet.</div>}
          {[...data.labels]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((label) => (
              <DropdownMenuCheckboxItem
                key={label._id}
                checked={filters.label.includes(slug(label.name))}
                onCheckedChange={() => toggle("label", slug(label.name))}
                closeOnClick={false}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ background: resolveLabelColor(label.color) }} aria-hidden />
                <span className="truncate">{label.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
        </Facet>
      )}

      {facets.includes("priority") && (
        <Facet
          label="Priority"
          active={filters.priority.length}
          summary={summary(filters.priority.map((priority) => PRIORITY_LABEL[priority]))}
          onClear={() => clearFacet("priority")}
        >
          {/* Urgent first, "No priority" last: the order you scan in. */}
          {[...PRIORITIES.slice(1), 0 as const].map((priority) => (
            <DropdownMenuCheckboxItem
              key={priority}
              checked={filters.priority.includes(priority)}
              onCheckedChange={() => toggle("priority", priority)}
              closeOnClick={false}
            >
              <PriorityGlyph priority={priority} />
              {PRIORITY_LABEL[priority]}
            </DropdownMenuCheckboxItem>
          ))}
        </Facet>
      )}

      {facets.includes("project") && (
        <Facet
          label="Project"
          active={filters.project.length}
          summary={summary(
            filters.project.map((value) =>
              value === "none" ? "No project" : projects.find((row) => slug(row.name) === value)?.name,
            ),
          )}
          onClear={() => clearFacet("project")}
        >
          {[...projects.map((project) => ({ value: slug(project.name), name: project.name, project })), { value: "none", name: "No project", project: null }].map(
            (option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={filters.project.includes(option.value)}
                onCheckedChange={() => toggle("project", option.value)}
                closeOnClick={false}
              >
                {option.project ? (
                  <span className="size-2 shrink-0 rounded-[2px]" style={{ background: projectColor(option.project) }} aria-hidden />
                ) : (
                  <LayersIcon />
                )}
                <span className="truncate">{option.name}</span>
              </DropdownMenuCheckboxItem>
            ),
          )}
        </Facet>
      )}

      {hasFilters(filters) && (
        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setFilters(EMPTY_FILTERS)}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

/** "Todo", "Todo, In Progress", or "3 selected". */
function summary(names: Array<string | undefined>): string {
  const known = names.filter((name): name is string => Boolean(name));
  if (known.length === 0) return "";
  return known.length <= 2 ? known.join(", ") : `${known.length} selected`;
}

function Facet({
  label,
  active,
  summary: text,
  onClear,
  children,
}: {
  label: string;
  active: number;
  summary: string;
  onClear: () => void;
  children: ReactNode;
}) {
  const on = active > 0;
  return (
    <span className={cn("flex h-control-sm items-center rounded-sm", on && "border border-border bg-background")}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex h-full max-w-56 cursor-default items-center gap-1 rounded-sm px-2 text-xs outline-none transition-colors duration-(--duration-instant)",
            "hover:bg-accent aria-expanded:bg-accent",
            on ? "text-foreground" : "text-muted-foreground",
            focusRing,
          )}
          aria-label={on ? `${label}: ${text}. Change the ${label.toLowerCase()} filter` : `Filter by ${label.toLowerCase()}`}
        >
          {on ? (
            <span className="truncate">
              <span className="text-muted-foreground">{label}:</span> {text}
            </span>
          ) : (
            <>
              {label}
              <ChevronDownIcon className="size-3" aria-hidden />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            {children}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {on && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear the ${label.toLowerCase()} filter`}
          className={cn(
            "flex h-full w-5 items-center justify-center rounded-r-sm border-l border-border text-muted-foreground hover:bg-accent hover:text-foreground",
            focusRing,
          )}
        >
          <XIcon className="size-3" />
        </button>
      )}
    </span>
  );
}
