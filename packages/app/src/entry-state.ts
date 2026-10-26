/**
 * Where a visitor stands, derived from Convex's auth state and the public `setup.status` query.
 * Pure so the transitions (sign-up, sign-in, sign-out, setup) are unit tested.
 */

export type SetupStatus = {
  needsSetup: boolean;
  needsSecret: boolean;
  signedIn: boolean;
  isMember: boolean;
};

export type EntryState =
  | { kind: "loading"; reason: "auth" | "status" | "auth-status-mismatch" }
  | { kind: "needs-secret" }
  | { kind: "needs-setup"; signedIn: boolean }
  | { kind: "signed-out" }
  | { kind: "not-member" }
  | { kind: "ready" };

export function deriveEntryState(
  auth: { isLoading: boolean; isAuthenticated: boolean },
  status: SetupStatus | undefined,
): EntryState {
  // A missing secret blocks everything, whatever the auth state.
  if (status?.needsSecret) return { kind: "needs-secret" };
  if (auth.isLoading) return { kind: "loading", reason: "auth" };
  if (status === undefined) return { kind: "loading", reason: "status" };
  // setup.status re-runs on the server after sign-in/out; for a moment the result can describe the
  // previous identity. Wait for it rather than acting on a stale answer (the loading screen's
  // safety net covers the case where it never catches up).
  if (status.signedIn !== auth.isAuthenticated) return { kind: "loading", reason: "auth-status-mismatch" };
  if (status.needsSetup) return { kind: "needs-setup", signedIn: auth.isAuthenticated };
  if (!auth.isAuthenticated) return { kind: "signed-out" };
  if (!status.isMember) return { kind: "not-member" };
  return { kind: "ready" };
}
