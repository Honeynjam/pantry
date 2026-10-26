"use client";

import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { fetchWithTimeout } from "./fetch-timeout";

/**
 * Every auth request gives up after this long. Without it a stalled request (a cold serverless
 * function, a dropped connection) never settles, and everything waiting on it waits forever.
 */
export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Better Auth client. On the web it talks to the same origin (`/api/auth`, proxied to Convex).
 * The Mac app (M5) will pass the server URL and add the cross-domain plugin.
 */
export function createPantryAuthClient(baseURL?: string) {
  return createAuthClient({
    baseURL,
    plugins: [convexClient()],
    // Applies to every auth request, including the session fetch (see fetch-timeout.ts).
    fetchOptions: { customFetchImpl: fetchWithTimeout(AUTH_REQUEST_TIMEOUT_MS) },
  });
}

export type PantryAuthClient = ReturnType<typeof createPantryAuthClient>;
