import { useAuthClient } from "@pantry/app";
import { api } from "@pantry/backend/api";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect } from "react";

/**
 * Spike evidence: the webview's origin, the session and two Convex queries run with the Better Auth
 * JWT (`setup.status` sees the user, `workspace.current` needs a member). Debug builds also print
 * each change to the terminal and can snapshot the window (src-tauri/src/spike.rs).
 */
export function SpikeStatus({ source }: { source: string }) {
  const authClient = useAuthClient();
  const session = authClient.useSession();
  const { isAuthenticated } = useConvexAuth();
  const status = useQuery(api.setup.status);
  const current = useQuery(api.workspace.current, status?.isMember ? {} : "skip");

  const email = session.data?.user.email;
  const workspace = current
    ? `${current.workspace.name} (${current.projects.length} projects, ${current.statuses.length} statuses, me: ${current.me.role})`
    : null;
  const report = [
    `origin=${window.location.origin}`,
    `server=${source}`,
    `session=${email ?? "none"}`,
    `convexAuth=${isAuthenticated}`,
    `setup.status=${status ? JSON.stringify(status) : "loading"}`,
    `workspace.current=${workspace ?? "none"}`,
  ].join(" | ");

  useEffect(() => {
    if (isTauri()) invoke("spike_report", { message: report }).catch(() => {});
  }, [report]);

  const loaded = workspace !== null;
  useEffect(() => {
    if (!loaded || !isTauri()) return;
    // Let fonts and the shell's entrance motion settle before the snapshot.
    const timer = setTimeout(() => invoke("spike_snapshot").catch(() => {}), 1500);
    return () => clearTimeout(timer);
  }, [loaded]);

  return (
    <aside
      aria-label="Spike status"
      className="border-border bg-background/90 text-muted-foreground pointer-events-none fixed right-3 bottom-3 z-50 flex max-w-md flex-col gap-0.5 rounded-md border px-3 py-2 font-mono text-[11px] leading-4 shadow-sm"
    >
      <span>origin {window.location.origin}</span>
      <span>server {source}</span>
      <span>
        session {email ?? "signed out"} · convex auth {String(isAuthenticated)}
      </span>
      <span className="text-foreground">workspace.current {workspace ?? "–"}</span>
    </aside>
  );
}
