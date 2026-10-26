"use client";

import { ConvexReactClient } from "convex/react";
import { createContext, useContext, type ReactNode } from "react";
import { createPantryAuthClient, type PantryAuthClient } from "./auth-client";
import { ConvexBetterAuth } from "./convex-auth";

const AuthClientContext = createContext<PantryAuthClient | null>(null);

export function useAuthClient(): PantryAuthClient {
  const client = useContext(AuthClientContext);
  if (!client) throw new Error("useAuthClient must be used inside <PantryProviders>");
  return client;
}

/**
 * One Convex client and one auth client per server, created outside React. Creating them in a
 * useState initializer is a render side effect: React can render a mounting tree several times
 * before it commits, and every attempt built new clients whose session stores fetched the session
 * at once (observed: ~1,600 session requests in a second).
 */
const clients = new Map<string, { convex: ConvexReactClient; auth: PantryAuthClient }>();

function getClients(convexUrl: string, authBaseUrl: string | undefined, crossDomain: boolean) {
  const key = `${convexUrl}|${authBaseUrl ?? ""}|${crossDomain ? "cross-domain" : "same-origin"}`;
  let entry = clients.get(key);
  if (!entry) {
    entry = {
      convex: new ConvexReactClient(convexUrl),
      auth: createPantryAuthClient(authBaseUrl, { crossDomain }),
    };
    clients.set(key, entry);
  }
  return entry;
}

/** Convex + Better Auth for every screen. Client-only: render it after mount. */
export function PantryProviders({
  convexUrl,
  authBaseUrl,
  crossDomain = false,
  children,
}: {
  convexUrl: string;
  authBaseUrl?: string;
  /** Mac app: talk to the `.convex.site` auth routes directly (see createPantryAuthClient). */
  crossDomain?: boolean;
  children: ReactNode;
}) {
  const { convex, auth } = getClients(convexUrl, authBaseUrl, crossDomain);
  return (
    <ConvexBetterAuth client={convex} authClient={auth} crossDomain={crossDomain}>
      <AuthClientContext value={auth}>{children}</AuthClientContext>
    </ConvexBetterAuth>
  );
}
