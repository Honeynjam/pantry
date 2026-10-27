"use client";

import { api } from "@pantry/backend/api";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, type ReactNode } from "react";
import { deriveEntryState, type EntryState } from "./entry-state";
import { routes, useNavigation } from "./navigation";
import { LoadingScreen } from "./screens/loading";

export type { EntryState } from "./entry-state";

/** Where the visitor stands: setup, signed out, signed in without access, or in. */
export function useEntryState(): EntryState {
  const auth = useConvexAuth();
  const status = useQuery(api.setup.status);
  return deriveEntryState(auth, status);
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
  const auth = useConvexAuth();
  const status = useQuery(api.setup.status);
  const state = deriveEntryState(auth, status);
  const { navigate, pathname } = useNavigation();
  const allowed = state.kind !== "loading" && allow.includes(state.kind);
  const target = state.kind === "loading" || allowed ? null : HOME_FOR[state.kind];

  useEffect(() => {
    if (target) navigate(target, { replace: true });
  }, [target, navigate]);

  if (!allowed) {
    return (
      <LoadingScreen
        diagnostics={() => ({
          pathname,
          state,
          redirectingTo: target,
          auth,
          status: status ?? "pending",
        })}
      />
    );
  }
  return <>{children(state)}</>;
}
