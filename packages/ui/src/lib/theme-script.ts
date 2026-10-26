/** Server-safe theme helpers (no "use client"): usable from a Next.js root layout. */

export const DARK_QUERY = "(prefers-color-scheme: dark)";

type ThemeChoice = "system" | "light" | "dark";

/**
 * Inline <head> script that sets `.dark` before first paint. Render it with
 * `<script dangerouslySetInnerHTML={{ __html: themeInitScript(storageKey) }} />`.
 */
export function themeInitScript(storageKey = "theme", defaultTheme: ThemeChoice = "system"): string {
  return `(function(){try{var t=localStorage.getItem(${JSON.stringify(storageKey)})||${JSON.stringify(
    defaultTheme,
  )};var d=t==="dark"||(t!=="light"&&window.matchMedia("${DARK_QUERY}").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
}
