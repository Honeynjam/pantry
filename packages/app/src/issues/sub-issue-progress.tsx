import type { Doc } from "@pantry/backend/dataModel";

/** "◔ 1/3": done or canceled sub-issues out of all, as a tiny ring and a count. */
export function SubIssueProgress({ subIssues }: { subIssues: Pick<Doc<"issues">, "statusCategory">[] }) {
  const closed = subIssues.filter((issue) => issue.statusCategory === "done" || issue.statusCategory === "canceled").length;
  const total = subIssues.length;
  const angle = total ? (closed / total) * 360 : 0;
  return (
    <span
      className="flex shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground tabular"
      title={`${closed} of ${total} sub-issues done`}
    >
      <span
        aria-hidden
        className="size-3 rounded-full border border-gray-8"
        style={{ background: `conic-gradient(var(--muted-foreground) ${angle}deg, transparent 0)` }}
      />
      {closed}/{total}
    </span>
  );
}
