import { describe, expect, it, vi } from "vitest";
import { fetchTokenWithRetry, recoveryDelayMs } from "./convex-token";

const noSleep = vi.fn(async () => {});

describe("fetchTokenWithRetry", () => {
  it("returns the first token", async () => {
    const fetchOnce = vi.fn(async () => "jwt");
    expect(await fetchTokenWithRetry(fetchOnce, { sleep: noSleep })).toBe("jwt");
    expect(fetchOnce).toHaveBeenCalledTimes(1);
  });

  it("retries after an empty answer, a thrown error and a rejection", async () => {
    const answers: Array<() => Promise<string | null>> = [
      async () => null,
      async () => {
        throw new Error("504");
      },
      () => Promise.reject(new Error("timeout")),
      async () => "jwt",
    ];
    const fetchOnce = vi.fn(() => answers.shift()!());
    const sleep = vi.fn(async () => {});
    expect(await fetchTokenWithRetry(fetchOnce, { attempts: 4, delaysMs: [10, 20], sleep })).toBe(
      "jwt",
    );
    expect(fetchOnce).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map((call) => (call as unknown[])[0])).toEqual([10, 20, 20]);
  });

  it("gives up with null after the last attempt, without a trailing wait", async () => {
    const fetchOnce = vi.fn(async () => null);
    const sleep = vi.fn(async () => {});
    expect(await fetchTokenWithRetry(fetchOnce, { attempts: 3, sleep })).toBeNull();
    expect(fetchOnce).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});

describe("recoveryDelayMs", () => {
  it("backs off exponentially and caps at a minute", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map(recoveryDelayMs)).toEqual([
      3000, 6000, 12000, 24000, 48000, 60000, 60000, 60000,
    ]);
  });
});
