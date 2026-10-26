"use client";

import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { fetchWithTimeout } from "./fetch-timeout";

/**
 * Every auth request gives up after this long. Without it a stalled request (a cold serverless
 * function, a dropped connection) never settles, and everything waiting on it waits forever.
 */
export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

export type PantryAuthClientOptions = {
  /**
   * Mac app: talk to the deployment's `.convex.site` auth routes directly. The session then travels
   * in a `Better-Auth-Cookie` header (added to every request by the cross-domain plugin) and is kept
   * in the webview's localStorage (docs/spikes/tauri-auth.md). The web app leaves this off and uses
   * first-party cookies through its same-origin `/api/auth` proxy.
   */
  crossDomain?: boolean;
};

/**
 * Better Auth client. On the web it talks to the same origin (`/api/auth`, proxied to Convex).
 * The Mac app passes the `.convex.site` URL and `crossDomain: true`.
 */
export function createPantryAuthClient(baseURL?: string, options: PantryAuthClientOptions = {}) {
  return createAuthClient({
    baseURL,
    plugins: options.crossDomain ? [convexClient(), crossDomainClient()] : [convexClient()],
    // Applies to every auth request, including the session fetch (see fetch-timeout.ts). The
    // cross-domain plugin's headers and `credentials: "omit"` pass through unchanged.
    fetchOptions: { customFetchImpl: fetchWithTimeout(AUTH_REQUEST_TIMEOUT_MS) },
  });
}

export type PantryAuthClient = ReturnType<typeof createPantryAuthClient>;
