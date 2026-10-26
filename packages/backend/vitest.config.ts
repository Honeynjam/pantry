import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test", "@convex-dev/better-auth"] } },
    include: ["convex/**/*.test.ts"],
  },
});
