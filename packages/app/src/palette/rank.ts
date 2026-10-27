/**
 * Command palette matching (spec §9d), replacing cmdk's filter. Every query word must match the
 * item, in one of these ways (best first):
 *
 * 1. at the start of the label ("new" → **New** issue),
 * 2. at a word start in the label ("iss" → New **iss**ue),
 * 3. anywhere in the label ("sue" → New is**sue**),
 * 4. at a word start in the description or a keyword ("pan-4" → keyword PAN-42),
 * 5. as letters in order in the label ("shpr" → **Sh**are **pr**oject).
 *
 * A label that starts with the whole query ranks above everything else. Groups are ordered by
 * their best item. Matched label letters come back as indices so the row can set them in medium
 * weight.
 */

export type Rankable = {
  label: string;
  description?: string;
  keywords?: ReadonlyArray<string>;
};

export type Ranked<T> = { item: T; score: number; matches: number[] };

const SCORE = {
  wholePrefix: 1000,
  labelStart: 100,
  labelWordStart: 70,
  labelAnywhere: 50,
  extraWordStart: 30,
  inOrder: 10,
} as const;

export function queryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Indices where a word starts: 0, after a space or punctuation, or a lower→upper change. */
function wordStarts(text: string): Set<number> {
  const starts = new Set<number>([0]);
  for (let i = 1; i < text.length; i++) {
    const before = text[i - 1]!;
    const here = text[i]!;
    if (/[\s\-_/.:,()[\]]/.test(before) && !/\s/.test(here)) starts.add(i);
    else if (/[a-z]/.test(before) && /[A-Z]/.test(here)) starts.add(i);
  }
  return starts;
}

function range(from: number, length: number): number[] {
  return Array.from({ length }, (_, i) => from + i);
}

/** The best way one word matches, or null. */
function matchWord(
  word: string,
  labelLower: string,
  starts: Set<number>,
  extras: string[],
): { score: number; matches: number[] } | null {
  if (labelLower.startsWith(word))
    return { score: SCORE.labelStart, matches: range(0, word.length) };

  let anywhere = -1;
  for (let at = labelLower.indexOf(word); at >= 0; at = labelLower.indexOf(word, at + 1)) {
    if (starts.has(at)) return { score: SCORE.labelWordStart, matches: range(at, word.length) };
    if (anywhere < 0) anywhere = at;
  }
  if (anywhere >= 0) return { score: SCORE.labelAnywhere, matches: range(anywhere, word.length) };

  for (const extra of extras) {
    const lower = extra.toLowerCase();
    const extraStarts = wordStarts(extra);
    for (let at = lower.indexOf(word); at >= 0; at = lower.indexOf(word, at + 1)) {
      if (extraStarts.has(at)) return { score: SCORE.extraWordStart, matches: [] };
    }
  }

  // Letters in order, preferring word starts so "shpr" lights up Sh·are pr·oject.
  const matches: number[] = [];
  let from = 0;
  for (const char of word) {
    let found = -1;
    for (let i = from; i < labelLower.length; i++) {
      if (labelLower[i] !== char) continue;
      if (found < 0) found = i;
      if (starts.has(i)) {
        found = i;
        break;
      }
      // Keep a run going: the letter right after the previous match beats a later word start.
      if (matches.length > 0 && i === matches[matches.length - 1]! + 1) break;
    }
    if (found < 0) return null;
    matches.push(found);
    from = found + 1;
  }
  return { score: SCORE.inOrder, matches };
}

/** Score one item against the query words; null when a word doesn't match. */
export function rankItem<T extends Rankable>(item: T, words: string[]): Ranked<T> | null {
  if (words.length === 0) return { item, score: 0, matches: [] };
  const labelLower = item.label.toLowerCase();
  const starts = wordStarts(item.label);
  const extras = [item.description ?? "", ...(item.keywords ?? [])].filter(Boolean);
  let score = 0;
  const matches = new Set<number>();
  for (const word of words) {
    const match = matchWord(word, labelLower, starts, extras);
    if (!match) return null;
    score += match.score;
    for (const index of match.matches) matches.add(index);
  }
  if (labelLower.startsWith(words.join(" "))) score += SCORE.wholePrefix;
  return { item, score, matches: [...matches].sort((a, b) => a - b) };
}

/** Matching items, best first; ties keep their original order (shorter labels first). */
export function rank<T extends Rankable>(items: ReadonlyArray<T>, query: string): Ranked<T>[] {
  const words = queryWords(query);
  return items
    .map((item, index) => ({ ranked: rankItem(item, words), index }))
    .filter((entry): entry is { ranked: Ranked<T>; index: number } => entry.ranked !== null)
    .sort(
      (a, b) =>
        b.ranked.score - a.ranked.score ||
        (words.length > 0 ? a.ranked.item.label.length - b.ranked.item.label.length : 0) ||
        a.index - b.index,
    )
    .map((entry) => entry.ranked);
}

export type RankedGroup<T> = { group: string; best: number; items: Ranked<T>[] };

/** Rank within each group, then order the groups by their best item (stable for ties). */
export function rankGroups<T extends Rankable & { group: string }>(
  items: ReadonlyArray<T>,
  query: string,
  groupOrder: ReadonlyArray<string>,
): RankedGroup<T>[] {
  const groups = groupOrder.map((group) => {
    const ranked = rank(
      items.filter((item) => item.group === group),
      query,
    );
    return { group, best: ranked[0]?.score ?? -1, items: ranked };
  });
  return groups
    .filter((group) => group.items.length > 0)
    .map((group, index) => ({ group, index }))
    .sort((a, b) => b.group.best - a.group.best || a.index - b.index)
    .map((entry) => entry.group);
}

/** Split a label into plain and matched runs for rendering. */
export function highlightRuns(
  label: string,
  matches: ReadonlyArray<number>,
): { text: string; matched: boolean }[] {
  const set = new Set(matches);
  const runs: { text: string; matched: boolean }[] = [];
  for (let i = 0; i < label.length; i++) {
    const matched = set.has(i);
    const last = runs[runs.length - 1];
    if (last && last.matched === matched) last.text += label[i];
    else runs.push({ text: label[i]!, matched });
  }
  return runs;
}
