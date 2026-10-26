import { ConvexError } from "convex/values";

/** A user-facing error: `message` is shown as-is by the app (and by MCP tools later). */
export function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

export const notFound = (what: string): never => fail("NOT_FOUND", `${what} not found.`);
