"use client";

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { ShortcutId } from "../shortcuts";

export type PaletteGroup = "Issues" | "Projects" | "Navigation" | "Actions";

/** One palette row. `id` must be unique in the palette; `run` happens after the palette closes. */
export type PaletteAction = {
  id: string;
  label: string;
  group: PaletteGroup;
  description?: string;
  keywords?: string[];
  icon?: ReactNode;
  /** Shows the shortcut's keycap from the registry. */
  shortcut?: ShortcutId;
  run: () => void;
};

/**
 * Actions the current screen adds to the palette (the issue page: copy key, change status…).
 * A small store outside React state: screens re-register freely without re-rendering the shell.
 */
const providers = new Map<string, () => PaletteAction[]>();
const listeners = new Set<() => void>();
let version = 0;

function notify() {
  version += 1;
  for (const listener of listeners) listener();
}

export function screenActions(): PaletteAction[] {
  return [...providers.values()].flatMap((get) => get());
}

/** Re-render when screens add or remove their actions. */
export function useScreenActionsVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
    () => version,
  );
}

/** Add actions to the palette while this component is mounted. `build` runs when the palette renders. */
export function usePaletteActions(build: () => PaletteAction[]) {
  const id = useId();
  const latest = useRef(build);
  useEffect(() => {
    latest.current = build;
  });
  useEffect(() => {
    providers.set(id, () => latest.current());
    notify();
    return () => {
      providers.delete(id);
      notify();
    };
  }, [id]);
}
