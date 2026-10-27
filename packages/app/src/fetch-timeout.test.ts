import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "./fetch-timeout";

/** A fetch that never answers, but rejects when its signal aborts (like the real one). */
const hangingFetch = vi.fn(
  (_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }),
);

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hangingFetch.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("aborts a request that never answers", async () => {
    const request = fetchWithTimeout(1000, hangingFetch)("/api/auth/get-session");
    const settled = expect(request).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(1000);
    await settled;
  });

  it("still aborts when the caller passed its own signal (better-fetch skips its timeout then)", async () => {
    const caller = new AbortController();
    const request = fetchWithTimeout(1000, hangingFetch)("/api/auth/get-session", {
      signal: caller.signal,
    });
    const settled = expect(request).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(1000);
    await settled;
  });

  it("honours the caller's abort before the timeout", async () => {
    const caller = new AbortController();
    const request = fetchWithTimeout(10_000, hangingFetch)("/x", { signal: caller.signal });
    const settled = expect(request).rejects.toBe("caller gave up");
    caller.abort("caller gave up");
    await settled;
  });

  it("passes fast responses through and clears its timer", async () => {
    const ok = new Response("{}", { status: 200 });
    const quick = vi.fn(async () => ok);
    await expect(fetchWithTimeout(1000, quick)("/x")).resolves.toBe(ok);
    expect(vi.getTimerCount()).toBe(0);
  });
});
