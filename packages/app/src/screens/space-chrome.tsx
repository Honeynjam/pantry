"use client";

import { IssueKey } from "@pantry/ui/components/issue-key";
import { cn } from "@pantry/ui/lib/utils";
import { InboxIcon } from "lucide-react";
import { SpaceAvatar } from "../components/space-avatar";
import { routes, useNavigation } from "../navigation";
import type { WorkspaceData } from "../shell/app-shell";

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
      <SpaceAvatar space={space ?? { key: spaceKey }} size="sm" />
      <span className="text-foreground truncate font-medium">{space?.name ?? spaceKey}</span>
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
                  ? "bg-selected text-foreground font-medium"
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
      <InboxIcon className="text-muted-foreground size-5" aria-hidden />
      <p className="text-foreground text-sm font-medium">
        There&apos;s no space with the key {spaceKey}
      </p>
      <p className="text-muted-foreground max-w-sm text-sm">
        It may have been archived. Pick a space from the sidebar.
      </p>
    </div>
  );
}
