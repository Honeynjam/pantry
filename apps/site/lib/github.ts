import { links } from "./content";

/** Below this, a star count reads as a weakness, not proof: show the button without it. */
const MIN_STARS_SHOWN = 50;

/**
 * The repo's star count, refreshed hourly. Null while it's under MIN_STARS_SHOWN, the repo is
 * private, or GitHub is unreachable.
 */
export async function getStarCount(): Promise<number | null> {
  try {
    const response = await fetch(links.repoApi, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { stargazers_count?: unknown };
    const stars = data.stargazers_count;
    return typeof stars === "number" && stars >= MIN_STARS_SHOWN ? stars : null;
  } catch {
    return null;
  }
}
