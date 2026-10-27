"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import ClientApp from "./client-app";

const subscribe = () => () => {};

/**
 * The app is a client-only SPA over Convex (the same screens ship in the Tauri app): render nothing
 * on the server and during hydration, then mount the app. Deliberately not next/dynamic with
 * `ssr: false`: that wraps the page tree in a lazy Suspense boundary that has to hydrate, and auth
 * updates arriving during that hydration restarted the render endlessly in production (the page
 * stayed on "Loading…" until a reload).
 */
export function ClientRoot({ children }: { children: ReactNode }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return isClient ? <ClientApp>{children}</ClientApp> : null;
}
