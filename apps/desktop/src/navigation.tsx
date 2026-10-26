import { type LinkProps, type Navigation } from "@pantry/app";
import { useMemo, useState, type MouseEvent } from "react";

/**
 * In-memory routing for the static build: Tauri serves one index.html, so there is no server to
 * resolve deep links. Enough for the spike; M5 can swap in a real client router behind the same
 * Navigation interface.
 */
export function useMemoryNavigation(initial = "/"): Navigation {
  const [pathname, setPathname] = useState(initial);
  // One Link component for the app's lifetime (setPathname is stable), so links never remount.
  const [Link] = useState(
    () =>
      function Link({ href, onClick, ...props }: LinkProps) {
        return (
          <a
            href={href}
            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
              onClick?.(event);
              if (event.defaultPrevented || event.metaKey || event.ctrlKey) return;
              event.preventDefault();
              setPathname(href);
            }}
            {...props}
          />
        );
      },
  );
  return useMemo<Navigation>(() => {
    const [path = "/", query] = pathname.split("?");
    return { pathname: path, search: query ? `?${query}` : "", navigate: (to) => setPathname(to), Link };
  }, [pathname, Link]);
}
