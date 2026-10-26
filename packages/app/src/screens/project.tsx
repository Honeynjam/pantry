"use client";

import { InboxIcon } from "lucide-react";
import { EntryGate } from "../entry";
import { AppShell } from "../shell/app-shell";
import { NotMemberScreen } from "./not-member";
import { ProjectTitle } from "./project-chrome";

/** A project with no issues yet (list and board views arrive with the issues backend, M2). */
export function ProjectPage({ projectKey }: { projectKey: string }) {
  return (
    <EntryGate allow={["ready", "not-member"]}>
      {(state) =>
        state.kind === "not-member" ? (
          <NotMemberScreen />
        ) : (
          <AppShell title={(data) => <ProjectTitle data={data} projectKey={projectKey} view="list" />}>
            {(data) => {
              const project = data.projects.find((p) => p.key === projectKey);
              return (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <InboxIcon className="size-5 text-muted-foreground" aria-hidden />
                  <p className="text-sm font-medium text-foreground">
                    {project ? `No issues in ${project.name} yet` : `There's no project with the key ${projectKey}`}
                  </p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {project
                      ? "Issues you create here, or that your agents create over MCP, will show up in this list."
                      : "It may have been archived. Pick a project from the sidebar."}
                  </p>
                </div>
              );
            }}
          </AppShell>
        )
      }
    </EntryGate>
  );
}
