"use client";

import { useEffect, useRef } from "react";
import { shortcuts, type ShortcutHandler, type ShortcutId, type ShortcutScope } from "./shortcuts";

/** Listen for the registry's keys on the window while mounted (the app shell does this once). */
export function useShortcutListener() {
  useEffect(() => shortcuts.bind(window), []);
}

/** Push a scope while `active` (a page while mounted, an overlay while open). */
export function useShortcutScope(scope: ShortcutScope, active = true) {
  useEffect(() => (active ? shortcuts.push(scope) : undefined), [scope, active]);
}

/**
 * Handle a registered shortcut in `scope`. The handler can change every render; the registration
 * doesn't. Return `false` from it to let the key through.
 */
export function useShortcut(
  id: ShortcutId,
  scope: ShortcutScope,
  handler: ShortcutHandler,
  enabled = true,
) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    return shortcuts.register(id, scope, (event) => latest.current(event));
  }, [id, scope, enabled]);
}

/** Several shortcuts in one scope. The set of ids should stay the same between renders. */
export function useShortcutMap(
  scope: ShortcutScope,
  handlers: Partial<Record<ShortcutId, ShortcutHandler>>,
  enabled = true,
) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });
  const ids = Object.keys(handlers).sort().join(" ");
  useEffect(() => {
    if (!enabled || !ids) return;
    const offs = (ids.split(" ") as ShortcutId[]).map((id) =>
      shortcuts.register(id, scope, (event) => latest.current[id]?.(event)),
    );
    return () => offs.forEach((off) => off());
  }, [ids, scope, enabled]);
}
