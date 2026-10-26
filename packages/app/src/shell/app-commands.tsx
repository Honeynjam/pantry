"use client";

import type { Doc } from "@pantry/backend/dataModel";
import { useSidebar } from "@pantry/ui/components/sidebar";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { NewProjectDialog } from "../components/new-project-dialog";
import { NewIssueDialog, type NewIssueDefaults } from "../issues/new-issue-dialog";
import { CommandPalette } from "../palette/command-palette";
import { routes, useNavigation } from "../navigation";
import { useShortcut, useShortcutListener } from "../use-shortcuts";
import type { WorkspaceData } from "./app-shell";
import { lastProject, projectKeyFromPath, rememberProject } from "./locations";
import { ShortcutHelp } from "./shortcut-help";

export type NewIssueRequest = NewIssueDefaults & { project?: Doc<"projects"> };

export type AppCommands = {
  data: WorkspaceData;
  /** The project on screen, else the last one visited, else the first. */
  currentProject: Doc<"projects"> | undefined;
  openPalette: () => void;
  openHelp: () => void;
  newIssue: (request?: NewIssueRequest) => void;
  newProject: () => void;
  toggleSidebar: () => void;
};

const AppCommandsContext = createContext<AppCommands | null>(null);

export function useAppCommands(): AppCommands {
  const value = useContext(AppCommandsContext);
  if (!value) throw new Error("useAppCommands must be used inside <AppShell>");
  return value;
}

/**
 * The shell's keyboard layer: binds the shortcut registry to the window, owns the dialogs any
 * screen can open (palette, `?` help, new issue) and handles the global shortcuts.
 */
export function AppCommandsProvider({ data, children }: { data: WorkspaceData; children: ReactNode }) {
  useShortcutListener();
  const { pathname, navigate } = useNavigation();
  const { toggleSidebar } = useSidebar();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [creating, setCreating] = useState<NewIssueRequest | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);

  const keyOnScreen = projectKeyFromPath(pathname);
  useEffect(() => rememberProject(keyOnScreen), [keyOnScreen]);
  const currentProject =
    data.projects.find((project) => project.key === keyOnScreen) ??
    data.projects.find((project) => project.key === lastProject()) ??
    data.projects[0];

  const newIssue = useCallback(
    (request: NewIssueRequest = {}) => {
      if (!request.project && !currentProject) {
        toast("Create a project first", { description: "Issues live in projects. Add one from the sidebar." });
        return;
      }
      setCreating(request);
    },
    [currentProject],
  );

  const goToProject = (view: "list" | "board") => {
    if (!currentProject) return false;
    navigate(view === "list" ? routes.project(currentProject.key) : routes.board(currentProject.key));
  };

  useShortcut("palette", "global", () => setPaletteOpen(true));
  useShortcut("search", "global", () => setPaletteOpen(true));
  useShortcut("help", "global", () => setHelpOpen(true));
  useShortcut("sidebar", "global", () => toggleSidebar());
  useShortcut("newIssue", "global", () => newIssue());
  useShortcut("goMyIssues", "global", () => navigate(routes.myIssues));
  useShortcut("goProject", "global", () => goToProject("list"));
  useShortcut("goBoard", "global", () => goToProject("board"));

  const value = useMemo<AppCommands>(
    () => ({
      data,
      currentProject,
      openPalette: () => setPaletteOpen(true),
      openHelp: () => setHelpOpen(true),
      newIssue,
      newProject: () => setCreatingProject(true),
      toggleSidebar,
    }),
    [data, currentProject, newIssue, toggleSidebar],
  );

  const project = creating?.project ?? currentProject;
  return (
    <AppCommandsContext value={value}>
      {children}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <NewProjectDialog open={creatingProject} onOpenChange={setCreatingProject} />
      <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
      {project && (
        <NewIssueDialog
          open={creating !== null}
          onOpenChange={(open) => !open && setCreating(null)}
          data={data}
          project={project}
          defaults={creating ?? {}}
        />
      )}
    </AppCommandsContext>
  );
}
