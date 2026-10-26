"use client";

import { IssueKey } from "@pantry/ui/components/issue-key";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import { resolveLabelColor } from "@pantry/ui/lib/issue-meta";
import { FileTextIcon } from "lucide-react";
import { EntryGate } from "../entry";
import { routes, useNavigation } from "../navigation";
import { AppShell } from "../shell/app-shell";
import { spaceColor } from "../shell/space-color";
import { NotMemberScreen } from "./not-member";

export function HomePage() {
  return (
    <EntryGate allow={["ready", "not-member"]}>
      {(state) =>
        state.kind === "not-member" ? (
          <NotMemberScreen />
        ) : (
          <AppShell title={() => <span className="font-medium text-foreground">Home</span>}>
            {(data) => <WorkspaceHome data={data} />}
          </AppShell>
        )
      }
    </EntryGate>
  );
}

/** The empty workspace: what exists so far and where issues will appear. */
function WorkspaceHome({ data }: { data: Parameters<Parameters<typeof AppShell>[0]["children"]>[0] }) {
  const { Link } = useNavigation();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold text-foreground">{data.workspace.name}</h1>
        <p className="text-sm text-muted-foreground">No issues yet. Spaces, statuses and members are ready to go.</p>
      </div>

      <section aria-labelledby="home-spaces" className="flex flex-col gap-2">
        <h2 id="home-spaces" className="font-sans text-xs font-medium tracking-normal text-muted-foreground">
          Spaces
        </h2>
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
          {data.spaces.map((space) => (
            <li key={space._id}>
              <Link
                href={routes.space(space.key)}
                className="flex h-row items-center gap-3 px-3 text-sm transition-colors duration-(--duration-instant) hover:bg-accent"
              >
                <span className="size-2 rounded-full" style={{ background: spaceColor(space.key) }} aria-hidden />
                <span className="font-medium text-foreground">{space.name}</span>
                <IssueKey value={space.key} />
                <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileTextIcon className="size-3.5" aria-hidden />
                  Context doc
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="home-statuses" className="flex flex-col gap-2">
        <h2 id="home-statuses" className="font-sans text-xs font-medium tracking-normal text-muted-foreground">
          Workflow
        </h2>
        <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-border px-3 py-2.5">
          {data.statuses.map((status) => (
            <span key={status._id} className="flex items-center gap-1.5 text-sm text-foreground">
              <StatusGlyph category={status.category} color={resolveLabelColor(status.color)} />
              {status.name}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
