"use client";

import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client. On the web it talks to the same origin (`/api/auth`, proxied to Convex).
 * The Mac app (M5) will pass the server URL and add the cross-domain plugin.
 */
export function createPantryAuthClient(baseURL?: string) {
  return createAuthClient({ baseURL, plugins: [convexClient()] });
}

export type PantryAuthClient = ReturnType<typeof createPantryAuthClient>;
