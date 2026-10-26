"use client";

import { IssueKey } from "@pantry/ui/components/issue-key";
import { Button } from "@pantry/ui/components/button";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { NewSpaceDialog } from "../../components/new-space-dialog";
import { SpaceAvatar } from "../../components/space-avatar";
import { routes, useNavigation } from "../../navigation";
import type { WorkspaceData } from "../../shell/app-shell";
import { SettingsEmpty, SettingsGroup, SettingsList, SettingsPanel } from "./parts";

function projectCount(data: WorkspaceData, spaceId: string): string {
  const count = data.projects.filter((project) => project.spaceId === spaceId).length;
  return count === 0 ? "" : `${count} ${count === 1 ? "project" : "projects"}`;
}

export function SpacesSettings({ data }: { data: WorkspaceData }) {
  const { Link } = useNavigation();
  const [creating, setCreating] = useState(false);
  return (
    <SettingsPanel
      title="Spaces"
      description="A space is one of your products or a client. Each has its own key, issues, context doc and projects. Open one to rename it, edit its context doc, manage its projects or archive it."
      actions={
        <Button onClick={() => setCreating(true)} data-icon="inline-start">
          <PlusIcon />
          New space
        </Button>
      }
    >
      <SettingsGroup title="Active spaces" hint={<span className="font-mono tabular">{data.spaces.length}</span>}>
        {data.spaces.length === 0 ? (
          <SettingsEmpty>No active spaces.</SettingsEmpty>
        ) : (
          <SettingsList>
            {data.spaces.map((space) => (
              <li key={space._id}>
                <Link
                  href={routes.spaceSettings(space.key)}
                  className="group flex h-row items-center gap-3 px-3 text-sm transition-colors duration-(--duration-instant) hover:bg-accent"
                >
                  <SpaceAvatar space={space} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{space.name}</span>
                  <span className="text-xs text-muted-foreground">{space.kind === "client" ? "Client" : "Product"}</span>
                  <span className="text-xs text-muted-foreground tabular">
                    {projectCount(data, space._id)}
                  </span>
                  <IssueKey value={space.key} />
                  <span className="font-mono text-xs text-muted-foreground tabular" title="Issues created so far">
                    {space.nextIssueNumber - 1} issues
                  </span>
                  <ChevronRightIcon className="size-3.5 text-faint-foreground group-hover:text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </SettingsList>
        )}
      </SettingsGroup>
      <NewSpaceDialog open={creating} onOpenChange={setCreating} />
    </SettingsPanel>
  );
}
