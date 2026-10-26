/**
 * Where the user has been, for keyboard navigation: `G then P` goes to the project you were last
 * in, and `Esc` on an issue goes back to the list (with its filters) you opened it from.
 * Per tab, in memory: a fresh tab starts from the first project.
 */

let lastProjectKey: string | null = null;
let lastListHref: string | null = null;

/** The project a path belongs to: `/projects/PAN/board` → PAN, `/issues/PAN-42` → PAN. */
export function projectKeyFromPath(pathname: string): string | null {
  const project = pathname.match(/^\/projects\/([^/]+)/);
  if (project) return decodeURIComponent(project[1]!).toUpperCase();
  const issue = pathname.match(/^\/issues\/([A-Za-z][A-Za-z0-9]*)-\d+/);
  return issue ? issue[1]!.toUpperCase() : null;
}

export function rememberProject(key: string | null) {
  if (key) lastProjectKey = key;
}

export function lastProject(): string | null {
  return lastProjectKey;
}

/** List, board and My issues call this with their full href (filters included). */
export function rememberListLocation(href: string) {
  lastListHref = href;
}

export function lastListLocation(): string | null {
  return lastListHref;
}
