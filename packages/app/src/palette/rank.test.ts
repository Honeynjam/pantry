import { describe, expect, it } from "vitest";
import { highlightRuns, rank, rankGroups, rankItem, queryWords } from "./rank";

const items = [
  { label: "New issue", group: "Actions", keywords: ["create", "add"] },
  { label: "New project", group: "Actions" },
  { label: "Share project", group: "Actions", description: "Copy a link to the project" },
  { label: "Go to My issues", group: "Navigation", keywords: ["assigned"] },
  { label: "Pantry", group: "Projects", keywords: ["PAN"] },
  { label: "Website", group: "Projects", keywords: ["WEB"] },
  { label: "Fix login redirect after sign-up", group: "Issues", keywords: ["PAN-42"] },
];
const labels = (query: string) => rank(items, query).map((entry) => entry.item.label);

describe("palette ranking", () => {
  it("needs every word to match", () => {
    expect(labels("new proj")).toEqual(["New project"]);
    expect(labels("new zebra")).toEqual([]);
  });

  it("puts label prefixes first", () => {
    expect(labels("new")).toEqual(["New issue", "New project"]);
    expect(labels("pro")[0]).toBe("New project"); // word start beats in-order letters
  });

  it("matches anywhere in the label, but only at word starts in descriptions and keywords", () => {
    expect(labels("sue")).toEqual(["New issue", "Go to My issues"]);
    expect(labels("link")).toEqual(["Share project"]); // description word start
    expect(labels("ink")).toEqual([]); // mid-word in the description doesn't count
    expect(labels("pan-4")).toEqual(["Fix login redirect after sign-up"]);
    expect(labels("assigned")).toEqual(["Go to My issues"]);
  });

  it("finds letters in order ('shpr' finds Share project) and lights up the letters", () => {
    const [match] = rank(items, "shpr");
    expect(match?.item.label).toBe("Share project");
    expect(match?.matches).toEqual([0, 1, 6, 7]);
    expect(highlightRuns("Share project", match!.matches)).toEqual([
      { text: "Sh", matched: true },
      { text: "are ", matched: false },
      { text: "pr", matched: true },
      { text: "oject", matched: false },
    ]);
  });

  it("returns matched indices for label matches", () => {
    expect(rankItem(items[0]!, queryWords("iss"))?.matches).toEqual([4, 5, 6]);
    expect(rankItem(items[0]!, queryWords("New"))?.matches).toEqual([0, 1, 2]);
  });

  it("keeps everything in order for an empty query", () => {
    expect(labels("")).toEqual(items.map((item) => item.label));
  });

  it("orders groups by their best match", () => {
    const groups = rankGroups(items, "web", ["Issues", "Projects", "Navigation", "Actions"]);
    expect(groups.map((group) => group.group)).toEqual(["Projects"]);
    const mixed = rankGroups(items, "p", ["Issues", "Projects", "Navigation", "Actions"]);
    expect(mixed[0]?.group).toBe("Projects"); // "Pantry" starts with p
    const empty = rankGroups(items, "", ["Issues", "Projects", "Navigation", "Actions"]);
    expect(empty.map((group) => group.group)).toEqual([
      "Issues",
      "Projects",
      "Navigation",
      "Actions",
    ]);
  });
});
