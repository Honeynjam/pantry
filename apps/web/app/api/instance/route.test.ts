import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

// What the mocked Convex client answers for setup.status: a value, or an Error to reject with.
let answer: unknown;
let calls = 0;
vi.mock("convex/browser", () => ({
  ConvexHttpClient: function ConvexHttpClient() {
    return {
      query: async () => {
        calls += 1;
        if (answer instanceof Error) throw answer;
        return answer;
      },
    };
  },
}));

function configure(url?: string, site?: string) {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", url ?? "");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", site ?? "");
}

const status = (needsSecret: boolean) => ({
  needsSecret,
  needsSetup: true,
  signedIn: false,
  isMember: false,
});

describe("GET /api/instance", () => {
  beforeEach(() => {
    answer = undefined;
    calls = 0;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns the instance info with needsSecret from Convex", async () => {
    configure("https://happy-cat-123.convex.cloud", "https://happy-cat-123.convex.site");
    answer = status(false);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      name: "Pantry",
      convexUrl: "https://happy-cat-123.convex.cloud",
      convexSiteUrl: "https://happy-cat-123.convex.site",
      serverVersion: expect.stringMatching(/^\d+\.\d+\.\d+$/),
      minAppVersion: expect.stringMatching(/^\d+\.\d+\.\d+$/),
      needsSecret: false,
    });
  });

  it("reports needsSecret while BETTER_AUTH_SECRET is unset", async () => {
    configure("https://a.convex.cloud", "https://a.convex.site");
    answer = status(true);
    expect(await (await GET()).json()).toMatchObject({ needsSecret: true });
  });

  it("answers 503 when built without Convex URLs", async () => {
    configure();
    expect((await GET()).status).toBe(503);
    expect(calls).toBe(0);
  });

  it("answers 503 when Convex is unreachable", async () => {
    configure("https://a.convex.cloud", "https://a.convex.site");
    answer = new Error("offline");
    expect((await GET()).status).toBe(503);
  });
});
