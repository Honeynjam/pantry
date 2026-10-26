/// <reference types="vite/client" />
import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest } from "convex-test";
import { vi } from "vitest";
import schema from "./schema";

// Every Convex module except *.d.ts / *.test.ts (Vite 8's glob has no extglob, so use a negative pattern).
export const modules = import.meta.glob(["./**/*.*s", "!./**/*.*.*s"]);

export const TEST_SITE_URL = "http://localhost:3000";

/** Stub the Convex env vars our auth setup reads. */
export function stubAuthEnv(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    SITE_URL: TEST_SITE_URL,
    BETTER_AUTH_SECRET: "test-secret-0123456789abcdefghijklmnopqrstuvwxyz",
    CONVEX_SITE_URL: "http://127.0.0.1:3211",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

/** A convex-test instance with our schema; pass `withAuth` to register the Better Auth component. */
export function setupTest({ withAuth = false }: { withAuth?: boolean } = {}) {
  const t = convexTest(schema, modules);
  if (withAuth) betterAuthTest.register(t);
  return t;
}

export type TestConvex = ReturnType<typeof setupTest>;
