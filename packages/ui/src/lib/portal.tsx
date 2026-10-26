"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Where popups (menus, popovers, tooltips, dialogs) portal to. Defaults to document.body.
 * A themed subtree (for example the light half of /design while the page is dark) provides its own
 * container so its popups inherit its theme.
 */
const PortalContainerContext = createContext<HTMLElement | null>(null);

export function PortalContainerProvider({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: ReactNode;
}) {
  return <PortalContainerContext value={container}>{children}</PortalContainerContext>;
}

export function usePortalContainer(): HTMLElement | undefined {
  return useContext(PortalContainerContext) ?? undefined;
}
