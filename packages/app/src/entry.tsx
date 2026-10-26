"use client";

import { api } from "@pantry/backend/api";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, type ReactNode } from "react";
import { routes, useNavigation } from "./navigation";
import { LoadingScreen } from "./screens/loading";

export type EntryState =
  | { kind: "loading" }
  | { kind: "needs-secret" }
  | { kind: "needs-setup"; signedIn: boolean }
  | { kind: "signed-out" }
  | { kind: "not-member" }
  | { kind: "ready" };

/** Where the visitor stands: setup, signed out, signed in without access, or in. */
export function useEntryState(): EntryState {
  const auth = useConvexAuth();
  const status = useQuery(api.setup.status);
  if (auth.isLoading || status === undefined) return { kind: "loading" };
  if (status.needsSecret) return { kind: "needs-secret" };
  // The status query re-runs after sign-in/out; wait until it agrees with the client.
  if (status.signedIn !== auth.isAuthenticated) return { kind: "loading" };
  if (status.needsSetup) return { kind: "needs-setup", signedIn: auth.isAuthenticated };
  if (!auth.isAuthenticated) return { kind: "signed-out" };
  if (!status.isMember) return { kind: "not-member" };
  return { kind: "ready" };
}

type Kind = EntryState["kind"];

const HOME_FOR: Record<Exclude<Kind, "loading">, string> = {
  "needs-secret": routes.setup,
  "needs-setup": routes.setup,
  "signed-out": routes.signIn,
  "not-member": routes.home,
  ready: routes.home,
};

/**
 * Renders children only in the states a route allows; otherwise sends the visitor to the right
 * place (for example a signed-in member who opens /sign-in goes home).
 */
export function EntryGate({
  allow,
  children,
}: {
  allow: ReadonlyArray<Exclude<Kind, "loading">>;
  children: (state: EntryState) => ReactNode;
}) {
  const state = useEntryState();
  const { navigate } = useNavigation();
  const allowed = state.kind !== "loading" && allow.includes(state.kind);

  useEffect(() => {
    if (state.kind !== "loading" && !allow.includes(state.kind)) {
      navigate(HOME_FOR[state.kind], { replace: true });
    }
  }, [state.kind, allow, navigate]);

  if (!allowed) return <LoadingScreen />;
  return <>{children(state)}</>;
}
