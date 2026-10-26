"use client";

import { createContext, useContext, type AnchorHTMLAttributes, type ComponentType, type ReactNode } from "react";

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode };

/**
 * Routing is the host's job (Next.js on the web, a static router in Tauri later). Screens only
 * see this small interface, so packages/app never imports next/*.
 */
export type Navigation = {
  pathname: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  Link: ComponentType<LinkProps>;
};

const NavigationContext = createContext<Navigation | null>(null);

export function NavigationProvider({ value, children }: { value: Navigation; children: ReactNode }) {
  return <NavigationContext value={value}>{children}</NavigationContext>;
}

export function useNavigation(): Navigation {
  const value = useContext(NavigationContext);
  if (!value) throw new Error("useNavigation must be used inside <NavigationProvider>");
  return value;
}

export const routes = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  setup: "/setup",
  project: (key: string) => `/projects/${encodeURIComponent(key)}`,
} as const;
