"use client";

import { ConvexProviderWithAuth, type ConvexReactClient } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PantryAuthClient } from "./auth-client";
import { fetchTokenWithRetry, recoveryDelayMs } from "./convex-token";

/**
 * Convex ↔ Better Auth bridge (replaces @convex-dev/better-auth's ConvexBetterAuthProvider).
 *
 * Why our own: that provider shares one in-flight token promise across calls, so a single token
 * request that never settles poisons every later sign-in until the page reloads, and a failed
 * token refresh leaves Convex signed out while the Better Auth session is still valid. Here:
 * tokens are cached per session (never a pending promise), each fetch is bounded and retried, and
 * while a session exists without a working Convex token we keep re-trying with backoff.
 */
function useConvexAuthFromBetterAuth(authClient: PantryAuthClient) {
  const { data, isPending, error, refetch } = authClient.useSession();
  const sessionId = data?.session.id ?? null;

  // Loading only until the session has resolved once; later background refetches (focus, sign-in)
  // must not flip Convex back to "loading".
  const [settled, setSettled] = useState(false);
  if (!settled && !isPending) setSettled(true);

  // A failed session fetch (timeout, 5xx) would otherwise look like "signed out" until something
  // else triggers a refetch. Retry with backoff instead.
  const sessionFailures = useRef(0);
  useEffect(() => {
    if (!error || isPending) {
      if (!error) sessionFailures.current = 0;
      return;
    }
    sessionFailures.current += 1;
    const timer = setTimeout(() => void refetch(), recoveryDelayMs(sessionFailures.current));
    return () => clearTimeout(timer);
  }, [error, isPending, refetch]);

  // Bumping this hands Convex a new fetchAccessToken, which makes it set auth again.
  const [recoveryRound, setRecoveryRound] = useState(0);
  const tokenFailures = useRef(0);
  const cache = useRef<{ sessionId: string; token: string } | null>(null);
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
    },
    [],
  );

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!sessionId) return null;
      const cached = cache.current;
      if (!forceRefreshToken && cached?.sessionId === sessionId) return cached.token;

      const token = await fetchTokenWithRetry(async () => {
        const result = await authClient.convex.token({ fetchOptions: { throw: false } });
        return result.data?.token ?? null;
      });

      if (token) {
        cache.current = { sessionId, token };
        tokenFailures.current = 0;
        return token;
      }
      cache.current = null;
      tokenFailures.current += 1;
      if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
      recoveryTimer.current = setTimeout(
        () => setRecoveryRound((round) => round + 1),
        recoveryDelayMs(tokenFailures.current),
      );
      return null;
    },
    // recoveryRound is intentionally a dependency: a new function identity re-runs Convex's setAuth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authClient, sessionId, recoveryRound],
  );

  return useMemo(
    () => ({ isLoading: !settled, isAuthenticated: sessionId !== null, fetchAccessToken }),
    [settled, sessionId, fetchAccessToken],
  );
}

export function ConvexBetterAuth({
  client,
  authClient,
  children,
}: {
  client: ConvexReactClient;
  authClient: PantryAuthClient;
  children: ReactNode;
}) {
  // ConvexProviderWithAuth wants a stable hook; bind it to this auth client once.
  const useAuth = useMemo(
    () =>
      function useAuthForConvex() {
        return useConvexAuthFromBetterAuth(authClient);
      },
    [authClient],
  );
  return (
    <ConvexProviderWithAuth client={client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
