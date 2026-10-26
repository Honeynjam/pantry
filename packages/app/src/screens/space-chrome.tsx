"use client";

import { IssueKey } from "@pantry/ui/components/issue-key";
import { cn } from "@pantry/ui/lib/utils";
import { InboxIcon } from "lucide-react";
import { routes, useNavigation } from "../navigation";
import type { WorkspaceData } from "../shell/app-shell";
import { spaceColor } from "../shell/space-color";

export type SpaceView = "list" | "board" | "settings";

const VIEWS: { id: SpaceView; label: string; href: (key: string) => string }[] = [
  { id: "list", label: "List", href: routes.space },
  { id: "board", label: "Board", href: routes.board },
  { id: "settings", label: "Settings", href: routes.spaceSettings },
];

/** Header for space pages: dot, name, key, and the List / Board / Settings switch. */
export function SpaceTitle({
  data,
  spaceKey,
  view,
}: {
  data: WorkspaceData;
  spaceKey: string;
  view: SpaceView;
}) {
  const { Link, search } = useNavigation();
  const space = data.spaces.find((row) => row.key === spaceKey);
  // List and board share the filters, so switching keeps them.
  const carry = (id: SpaceView) => (id === "settings" ? "" : search);
  return (
    <>
      <span className="size-2 shrink-0 rounded-full" style={{ background: spaceColor(spaceKey) }} aria-hidden />
      <span className="truncate font-medium text-foreground">{space?.name ?? spaceKey}</span>
      <IssueKey value={spaceKey} />
      {space && (
        <nav aria-label="Space views" className="ml-2 flex items-center gap-0.5">
          {VIEWS.map((item) => (
            <Link
              key={item.id}
              href={item.href(spaceKey) + carry(item.id)}
              aria-current={item.id === view ? "page" : undefined}
              className={cn(
                "flex h-6 items-center rounded-sm px-2 text-xs transition-colors duration-(--duration-instant)",
                item.id === view
                  ? "bg-selected font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}

export function SpaceNotFound({ spaceKey }: { spaceKey: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <InboxIcon className="size-5 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium text-foreground">There&apos;s no space with the key {spaceKey}</p>
      <p className="max-w-sm text-sm text-muted-foreground">It may have been archived. Pick a space from the sidebar.</p>
    </div>
  );
}
