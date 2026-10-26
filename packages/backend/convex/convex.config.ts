import betterAuth from "@convex-dev/better-auth/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

// Both optional on purpose: a required var that the deploy key can't set would fail
// `convex deploy`, and the user would never reach the setup screen with its fix.
// auth.ts throws a clear error at runtime instead; /api/instance reports needsSecret.
const app = defineApp({
  env: {
    SITE_URL: v.optional(v.string()),
    BETTER_AUTH_SECRET: v.optional(v.string()),
  },
});

app.use(betterAuth);

export default app;
