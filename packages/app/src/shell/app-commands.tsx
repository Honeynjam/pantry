"use client";

import type { Doc } from "@pantry/backend/dataModel";
import { useSidebar } from "@pantry/ui/components/sidebar";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { NewSpaceDialog } from "../components/new-space-dialog";
import { NewIssueDialog, type NewIssueDefaults } from "../issues/new-issue-dialog";
import { CommandPalette } from "../palette/command-palette";
import { routes, useNavigation } from "../navigation";
import { useShortcut, useShortcutListener } from "../use-shortcuts";
import type { WorkspaceData } from "./app-shell";
import { lastSpace, spaceKeyFromPath, rememberSpace } from "./locations";
import { ShortcutHelp } from "./shortcut-help";

export type NewIssueRequest = NewIssueDefaults & { space?: Doc<"spaces"> };

export type AppCommands = {
  data: WorkspaceData;
  /** The space on screen, else the last one visited, else the first. */
  currentSpace: Doc<"spaces"> | undefined;
  openPalette: () => void;
  openHelp: () => void;
  newIssue: (request?: NewIssueRequest) => void;
  newSpace: () => void;
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
  const { pathname, search, navigate } = useNavigation();
  const { toggleSidebar } = useSidebar();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [creating, setCreating] = useState<NewIssueRequest | null>(null);
  const [creatingSpace, setCreatingSpace] = useState(false);

  const keyOnScreen = spaceKeyFromPath(pathname);
  useEffect(() => rememberSpace(keyOnScreen), [keyOnScreen]);
  const currentSpace =
    data.spaces.find((space) => space.key === keyOnScreen) ??
    data.spaces.find((space) => space.key === lastSpace()) ??
    data.spaces[0];

  const newIssue = useCallback(
    (request: NewIssueRequest = {}) => {
      if (!request.space && !currentSpace) {
        toast("Create a space first", { description: "Issues live in spaces. Add one from the sidebar." });
        return;
      }
      setCreating(request);
    },
    [currentSpace],
  );

  const goToSpace = (view: "list" | "board") => {
    if (!currentSpace) return false;
    const list = routes.space(currentSpace.key);
    const board = routes.board(currentSpace.key);
    // Between a space's list and board, the filters come along.
    const carry = pathname === list || pathname === board ? search : "";
    navigate((view === "list" ? list : board) + carry);
  };

  useShortcut("palette", "global", () => setPaletteOpen(true));
  useShortcut("search", "global", () => setPaletteOpen(true));
  useShortcut("help", "global", () => setHelpOpen(true));
  useShortcut("sidebar", "global", () => toggleSidebar());
  useShortcut("newIssue", "global", () => newIssue());
  useShortcut("goMyIssues", "global", () => navigate(routes.myIssues));
  useShortcut("goSpace", "global", () => goToSpace("list"));
  useShortcut("goBoard", "global", () => goToSpace("board"));

  const value = useMemo<AppCommands>(
    () => ({
      data,
      currentSpace,
      openPalette: () => setPaletteOpen(true),
      openHelp: () => setHelpOpen(true),
      newIssue,
      newSpace: () => setCreatingSpace(true),
      toggleSidebar,
    }),
    [data, currentSpace, newIssue, toggleSidebar],
  );

  const space = creating?.space ?? currentSpace;
  return (
    <AppCommandsContext value={value}>
      {children}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <NewSpaceDialog open={creatingSpace} onOpenChange={setCreatingSpace} />
      <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
      {space && (
        <NewIssueDialog
          open={creating !== null}
          onOpenChange={(open) => !open && setCreating(null)}
          data={data}
          space={space}
          defaults={creating ?? {}}
        />
      )}
    </AppCommandsContext>
  );
}
