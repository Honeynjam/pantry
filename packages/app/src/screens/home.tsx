"use client";

import { IssueKey } from "@pantry/ui/components/issue-key";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import { resolveLabelColor } from "@pantry/ui/lib/issue-meta";
import { FileTextIcon } from "lucide-react";
import { SpaceAvatar } from "../components/space-avatar";
import { EntryGate } from "../entry";
import { routes, useNavigation } from "../navigation";
import { AppShell } from "../shell/app-shell";
import { NotMemberScreen } from "./not-member";

export function HomePage() {
  return (
    <EntryGate allow={["ready", "not-member"]}>
      {(state) =>
        state.kind === "not-member" ? (
          <NotMemberScreen />
        ) : (
          <AppShell title={() => <span className="text-foreground font-medium">Home</span>}>
            {(data) => <WorkspaceHome data={data} />}
          </AppShell>
        )
      }
    </EntryGate>
  );
}

/** The empty workspace: what exists so far and where issues will appear. */
function WorkspaceHome({
  data,
}: {
  data: Parameters<Parameters<typeof AppShell>[0]["children"]>[0];
}) {
  const { Link } = useNavigation();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-foreground text-xl font-semibold">{data.workspace.name}</h1>
        <p className="text-muted-foreground text-sm">
          No issues yet. Spaces, statuses and members are ready to go.
        </p>
      </div>

      <section aria-labelledby="home-spaces" className="flex flex-col gap-2">
        <h2
          id="home-spaces"
          className="text-muted-foreground font-sans text-xs font-medium tracking-normal"
        >
          Spaces
        </h2>
        <ul className="divide-border border-border flex flex-col divide-y overflow-hidden rounded-lg border">
          {data.spaces.map((space) => (
            <li key={space._id}>
              <Link
                href={routes.space(space.key)}
                className="h-row hover:bg-accent flex items-center gap-3 px-3 text-sm transition-colors duration-(--duration-instant)"
              >
                <SpaceAvatar space={space} size="sm" />
                <span className="text-foreground font-medium">{space.name}</span>
                <IssueKey value={space.key} />
                <span className="text-muted-foreground ml-auto flex items-center gap-1.5 text-xs">
                  <FileTextIcon className="size-3.5" aria-hidden />
                  Context doc
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="home-statuses" className="flex flex-col gap-2">
        <h2
          id="home-statuses"
          className="text-muted-foreground font-sans text-xs font-medium tracking-normal"
        >
          Workflow
        </h2>
        <div className="border-border flex flex-wrap gap-x-5 gap-y-2 rounded-lg border px-3 py-2.5">
          {data.statuses.map((status) => (
            <span key={status._id} className="text-foreground flex items-center gap-1.5 text-sm">
              <StatusGlyph category={status.category} color={resolveLabelColor(status.color)} />
              {status.name}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
