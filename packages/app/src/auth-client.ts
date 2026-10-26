"use client";

import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client. On the web it talks to the same origin (`/api/auth`, proxied to Convex).
 * The Mac app passes the deployment's `.convex.site` URL and `crossDomain: true`: the session then
 * travels in a `Better-Auth-Cookie` header and is kept in the webview's localStorage
 * (docs/spikes/tauri-auth.md).
 */
export function createPantryAuthClient(baseURL?: string, options: { crossDomain?: boolean } = {}) {
  return createAuthClient({
    baseURL,
    plugins: options.crossDomain ? [convexClient(), crossDomainClient()] : [convexClient()],
  });
}

export type PantryAuthClient = ReturnType<typeof createPantryAuthClient>;
