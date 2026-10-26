/**
 * Pure helpers for getting a Convex token from Better Auth, kept separate so they're unit tested.
 */

export const TOKEN_ATTEMPTS = 3;
export const TOKEN_RETRY_DELAYS_MS = [400, 1200] as const;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Ask for a token up to `attempts` times. A thrown error, a rejected promise or an empty answer
 * counts as a failed attempt; returns null only when every attempt failed.
 */
export async function fetchTokenWithRetry(
  fetchOnce: () => Promise<string | null | undefined>,
  {
    attempts = TOKEN_ATTEMPTS,
    delaysMs = TOKEN_RETRY_DELAYS_MS,
    sleep = wait,
  }: { attempts?: number; delaysMs?: ReadonlyArray<number>; sleep?: (ms: number) => Promise<void> } = {},
): Promise<string | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const token = await fetchOnce();
      if (token) return token;
    } catch {
      // Treat like an empty answer and try again.
    }
    if (attempt < attempts - 1) {
      await sleep(delaysMs[Math.min(attempt, delaysMs.length - 1)] ?? 0);
    }
  }
  return null;
}

/**
 * After a failed round of attempts while a session still exists, try again after this long:
 * 3s, 6s, 12s, … capped at 60s. `failures` counts consecutive failed rounds (1-based).
 */
export function recoveryDelayMs(failures: number): number {
  return Math.min(3000 * 2 ** Math.max(0, failures - 1), 60_000);
}
