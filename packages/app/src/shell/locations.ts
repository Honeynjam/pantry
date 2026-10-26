/**
 * Where the user has been, for keyboard navigation: `G then S` goes to the space you were last
 * in, and `Esc` on an issue goes back to the list (with its filters) you opened it from.
 * Per tab, in memory: a fresh tab starts from the first space.
 */

let lastSpaceKey: string | null = null;
let lastListHref: string | null = null;

/** The space a path belongs to: `/spaces/PAN/board` → PAN, `/issues/PAN-42` → PAN. */
export function spaceKeyFromPath(pathname: string): string | null {
  const space = pathname.match(/^\/spaces\/([^/]+)/);
  if (space) return decodeURIComponent(space[1]!).toUpperCase();
  const issue = pathname.match(/^\/issues\/([A-Za-z][A-Za-z0-9]*)-\d+/);
  return issue ? issue[1]!.toUpperCase() : null;
}

export function rememberSpace(key: string | null) {
  if (key) lastSpaceKey = key;
}

export function lastSpace(): string | null {
  return lastSpaceKey;
}

/** List, board and My issues call this with their full href (filters included). */
export function rememberListLocation(href: string) {
  lastListHref = href;
}

export function lastListLocation(): string | null {
  return lastListHref;
}
