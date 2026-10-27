"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { DARK_QUERY } from "./theme-script";

export { themeInitScript } from "./theme-script";

export type Theme = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
function readStoredTheme(storageKey: string, fallback: Theme): Theme {
  try {
    const value = localStorage.getItem(storageKey);
    return value === "light" || value === "dark" || value === "system" ? value : fallback;
  } catch {
    return fallback;
  }
}

function subscribeSystem(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const getSystemDark = () => window.matchMedia(DARK_QUERY).matches;
const getServerSystemDark = () => false;

/** Apply the theme to <html> without letting every transition fire at once. */
function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  // Two frames: styles recalc with transitions off, then transitions come back.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => root.classList.remove("theme-switching")),
  );
}

/**
 * System / light / dark theme on `.dark` of <html>. Framework-free (no next-themes) so it runs in
 * the web app, the Tauri app and the site alike. Pair with `themeInitScript` to avoid a flash.
 */
export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
}: {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const systemDark = useSyncExternalStore(subscribeSystem, getSystemDark, getServerSystemDark);

  // Read the stored choice after mount (the inline script already applied it to <html>).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from localStorage once on mount
    setThemeState(readStoredTheme(storageKey, defaultTheme));
  }, [storageKey, defaultTheme]);

  const resolvedTheme: ResolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Follow changes made in other tabs/windows.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) setThemeState(readStoredTheme(storageKey, defaultTheme));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey, defaultTheme]);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // Storage can be unavailable (private mode); the choice still applies for this session.
      }
    },
    [storageKey],
  );

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}
