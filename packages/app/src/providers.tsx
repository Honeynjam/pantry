"use client";

import { ConvexBetterAuthProvider, type AuthClient } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createPantryAuthClient, type PantryAuthClient } from "./auth-client";

const AuthClientContext = createContext<PantryAuthClient | null>(null);

export function useAuthClient(): PantryAuthClient {
  const client = useContext(AuthClientContext);
  if (!client) throw new Error("useAuthClient must be used inside <PantryProviders>");
  return client;
}

/** Convex + Better Auth for every screen. Client-only: render it after mount. */
export function PantryProviders({
  convexUrl,
  authBaseUrl,
  children,
}: {
  convexUrl: string;
  authBaseUrl?: string;
  children: ReactNode;
}) {
  const [convex] = useState(() => new ConvexReactClient(convexUrl));
  const [authClient] = useState(() => createPantryAuthClient(authBaseUrl));
  return (
    // The component's AuthClient union doesn't accept a concretely typed client under TS 6; the
    // runtime shape is exactly what it expects (createAuthClient + convexClient plugin).
    <ConvexBetterAuthProvider client={convex} authClient={authClient as unknown as AuthClient}>
      <AuthClientContext value={authClient}>{children}</AuthClientContext>
    </ConvexBetterAuthProvider>
  );
}
