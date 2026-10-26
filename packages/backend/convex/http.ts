import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Lazy registration: createAuth only runs per request, so a missing
// BETTER_AUTH_SECRET never breaks `convex deploy`.
// CORS (allowed origins = Better Auth's trustedOrigins) lets the Mac app's webview call these routes
// directly; the web app goes through its same-origin /api/auth proxy and doesn't need it.
authComponent.registerRoutesLazy(http, createAuth, { cors: true });

export default http;
