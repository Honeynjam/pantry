import { getFunctionName } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVerifyToken } from "./auth";
import type { Backend } from "./backend";

const MINUTE = 60 * 1000;
const NOW = 1_800_000_000_000;
const owner = (lastUsedAt: number | null) => ({
  tokenId: "token1",
  memberId: "member1",
  workspaceId: "ws1",
  userId: "user1",
  displayName: "Kris",
  lastUsedAt,
});

function backendWith(verify: unknown, touch: () => unknown = () => true) {
  const calls: string[] = [];
  const backend = {
    query: async (fn: never) => {
      calls.push(getFunctionName(fn));
      return verify;
    },
    mutation: async (fn: never) => {
      calls.push(getFunctionName(fn));
      return touch();
    },
  } as unknown as Backend;
  return { backend, calls };
}

const req = new Request("https://pantry.example.com/api/mcp", { method: "POST" });
const verifier = (backend: Backend) =>
  createVerifyToken(backend, { appUrl: () => "https://pantry.example.com/", now: () => NOW });

describe("createVerifyToken", () => {
  afterEach(() => vi.restoreAllMocks());

  it("no bearer token: undefined, without asking Convex", async () => {
    const { backend, calls } = backendWith(owner(null));
    expect(await verifier(backend)(req, undefined)).toBeUndefined();
    expect(await verifier(backend)(req, "  ")).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it("an unknown or revoked token: undefined (withMcpAuth answers 401)", async () => {
    const { backend, calls } = backendWith(null);
    expect(await verifier(backend)(req, "pan_revoked")).toBeUndefined();
    expect(calls).toEqual(["mcp:verifyToken"]);
  });

  it("a live token: AuthInfo with the member and the instance URL", async () => {
    const { backend } = backendWith(owner(NOW - MINUTE));
    expect(await verifier(backend)(req, "pan_live")).toEqual({
      token: "pan_live",
      clientId: "token1",
      scopes: [],
      extra: { ...owner(0), lastUsedAt: undefined, appUrl: "https://pantry.example.com" },
    });
  });

  it("touches lastUsedAt only when it's 10 minutes old or never set", async () => {
    for (const [lastUsedAt, touched] of [
      [null, true],
      [NOW - 9 * MINUTE, false],
      [NOW - 10 * MINUTE, true],
      [NOW - 60 * MINUTE, true],
    ] as const) {
      const { backend, calls } = backendWith(owner(lastUsedAt));
      await verifier(backend)(req, "pan_live");
      expect(calls.includes("mcp:touchToken"), `lastUsedAt ${lastUsedAt}`).toBe(touched);
    }
  });

  it("a failed lastUsedAt write doesn't block the call", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { backend } = backendWith(owner(null), () => {
      throw new Error("offline");
    });
    expect(await verifier(backend)(req, "pan_live")).toMatchObject({ token: "pan_live" });
  });
});
