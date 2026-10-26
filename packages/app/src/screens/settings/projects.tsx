"use client";

import { IssueKey } from "@pantry/ui/components/issue-key";
import { Button } from "@pantry/ui/components/button";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { NewProjectDialog } from "../../components/new-project-dialog";
import { routes, useNavigation } from "../../navigation";
import type { WorkspaceData } from "../../shell/app-shell";
import { projectColor } from "../../shell/project-color";
import { SettingsEmpty, SettingsGroup, SettingsList, SettingsPanel } from "./parts";

export function ProjectsSettings({ data }: { data: WorkspaceData }) {
  const { Link } = useNavigation();
  const [creating, setCreating] = useState(false);
  return (
    <SettingsPanel
      title="Projects"
      description="Each project has its own key, issues and context doc. Open one to rename it, edit its context doc or archive it."
      actions={
        <Button onClick={() => setCreating(true)} data-icon="inline-start">
          <PlusIcon />
          New project
        </Button>
      }
    >
      <SettingsGroup title="Active projects" hint={<span className="font-mono tabular">{data.projects.length}</span>}>
        {data.projects.length === 0 ? (
          <SettingsEmpty>No active projects.</SettingsEmpty>
        ) : (
          <SettingsList>
            {data.projects.map((project) => (
              <li key={project._id}>
                <Link
                  href={routes.projectSettings(project.key)}
                  className="group flex h-row items-center gap-3 px-3 text-sm transition-colors duration-(--duration-instant) hover:bg-accent"
                >
                  <span className="size-2 rounded-full" style={{ background: projectColor(project.key) }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-foreground">{project.name}</span>
                  <IssueKey value={project.key} />
                  <span className="font-mono text-xs text-muted-foreground tabular" title="Issues created so far">
                    {project.nextIssueNumber - 1} issues
                  </span>
                  <ChevronRightIcon className="size-3.5 text-faint-foreground group-hover:text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </SettingsList>
        )}
      </SettingsGroup>
      <NewProjectDialog open={creating} onOpenChange={setCreating} />
    </SettingsPanel>
  );
}
