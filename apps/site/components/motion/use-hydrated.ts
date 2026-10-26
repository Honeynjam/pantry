"use client";

import * as React from "react";

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true after. Gate anything that renders different
 * content for reduced motion, so the first client render matches the server's.
 */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
