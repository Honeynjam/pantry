"use client";

import type { MarkdownEditor as Editor } from "@pantry/ui/components/markdown-editor";
import { useSyncExternalStore, type ComponentProps, type ReactNode } from "react";

export type { MarkdownEditorHandle } from "@pantry/ui/components/markdown-editor";

/*
 * The markdown editor (Tiptap, ProseMirror, marked: ~450 kB of the bundle) is loaded on first use,
 * so screens without one (sign-in, lists, boards) don't ship it. The app shell preloads it when the
 * browser is idle, and the issue and space-settings screens as soon as they mount, so it's normally
 * there before it's needed.
 *
 * Deliberately not React.lazy + Suspense: React throttles revealing suspended content (~300 ms),
 * which made the issue page appear later than the editor and the data did. Screens ask
 * `useMarkdownEditorReady()` and wait for it the way they wait for their query.
 */

let loaded: typeof Editor | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function preloadMarkdownEditor() {
  loading ??= import("@pantry/ui/components/markdown-editor").then(
    (module) => {
      loaded = module.MarkdownEditor;
      for (const listener of listeners) listener();
    },
    (error: unknown) => {
      // A chunk that failed to load (offline, a deploy in between): the next screen that needs it retries.
      loading = null;
      console.error("Couldn't load the markdown editor", error);
    },
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  preloadMarkdownEditor();
  return () => {
    listeners.delete(listener);
  };
}

/** Whether the editor has loaded; starts loading it if it hasn't. */
export function useMarkdownEditorReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => loaded !== null,
    () => false,
  );
}

/** The markdown editor once it has loaded, `fallback` until then (nothing by default). */
export function MarkdownEditor({
  fallback = null,
  ...props
}: ComponentProps<typeof Editor> & { fallback?: ReactNode }) {
  const ready = useMarkdownEditorReady();
  const Loaded = ready ? loaded : null;
  return Loaded ? <Loaded {...props} /> : <>{fallback}</>;
}

/** Run `task` when the browser is idle (or soon, where requestIdleCallback is missing). */
export function whenIdle(task: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(task, { timeout: 3000 });
    return () => window.cancelIdleCallback(handle);
  }
  const timer = setTimeout(task, 200);
  return () => clearTimeout(timer);
}
