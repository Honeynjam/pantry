import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@pantry/ui": new URL("./src", import.meta.url).pathname } },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
  },
});
