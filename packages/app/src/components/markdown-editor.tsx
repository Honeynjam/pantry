"use client";

import { lazy } from "react";

export type { MarkdownEditorHandle } from "@pantry/ui/components/markdown-editor";

const load = () => import("@pantry/ui/components/markdown-editor");

/**
 * The markdown editor (Tiptap, ProseMirror, marked: ~400 kB of the bundle), loaded on first use so
 * screens without one (sign-in, lists, boards) don't ship it. Every use sits inside a Suspense
 * boundary; the app shell preloads it when the browser is idle, and the issue and space-settings
 * pages as soon as they mount, so it's normally there before it's needed.
 */
export const MarkdownEditor = lazy(() => load().then((module) => ({ default: module.MarkdownEditor })));

export function preloadMarkdownEditor() {
  void load();
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
