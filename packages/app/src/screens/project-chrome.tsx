"use client";

import { IssueKey } from "@pantry/ui/components/issue-key";
import { cn } from "@pantry/ui/lib/utils";
import { InboxIcon } from "lucide-react";
import { routes, useNavigation } from "../navigation";
import type { WorkspaceData } from "../shell/app-shell";
import { projectColor } from "../shell/project-color";

export type ProjectView = "list" | "board" | "settings";

const VIEWS: { id: ProjectView; label: string; href: (key: string) => string }[] = [
  { id: "list", label: "List", href: routes.project },
  { id: "board", label: "Board", href: routes.board },
  { id: "settings", label: "Settings", href: routes.projectSettings },
];

/** Header for project pages: dot, name, key, and the List / Board / Settings switch. */
export function ProjectTitle({
  data,
  projectKey,
  view,
}: {
  data: WorkspaceData;
  projectKey: string;
  view: ProjectView;
}) {
  const { Link, search } = useNavigation();
  const project = data.projects.find((p) => p.key === projectKey);
  // List and board share the filters, so switching keeps them.
  const carry = (id: ProjectView) => (id === "settings" ? "" : search);
  return (
    <>
      <span className="size-2 shrink-0 rounded-full" style={{ background: projectColor(projectKey) }} aria-hidden />
      <span className="truncate font-medium text-foreground">{project?.name ?? projectKey}</span>
      <IssueKey value={projectKey} />
      {project && (
        <nav aria-label="Project views" className="ml-2 flex items-center gap-0.5">
          {VIEWS.map((item) => (
            <Link
              key={item.id}
              href={item.href(projectKey) + carry(item.id)}
              aria-current={item.id === view ? "page" : undefined}
              className={cn(
                "flex h-6 items-center rounded-sm px-2 text-xs transition-colors duration-(--duration-instant)",
                item.id === view
                  ? "bg-selected font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}

export function ProjectNotFound({ projectKey }: { projectKey: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <InboxIcon className="size-5 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium text-foreground">There&apos;s no project with the key {projectKey}</p>
      <p className="max-w-sm text-sm text-muted-foreground">It may have been archived. Pick a project from the sidebar.</p>
    </div>
  );
}
