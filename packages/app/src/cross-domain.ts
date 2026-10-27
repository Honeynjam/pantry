/**
 * The one cross-domain step @convex-dev/better-auth's ConvexBetterAuthProvider performed that the
 * cross-domain client plugin doesn't do on its own (the plugin already sends the stored
 * `Better-Auth-Cookie` header on every auth request and stores `Set-Better-Auth-Cookie` replies):
 * after a redirect-based sign-in the server sends the app back with `?ott=<one-time token>`. Verify
 * it, load the session it yields, and tell the session store to refresh.
 */

export type CrossDomainAuthActions = {
  crossDomain: {
    oneTimeToken: {
      verify: (args: {
        token: string;
      }) => Promise<{ data?: { session?: { token: string } } | null } | null>;
    };
  };
  getSession: (args: { fetchOptions: { headers: Record<string, string> } }) => Promise<unknown>;
  updateSession: () => void;
};

type LocationLike = { href: string };
type HistoryLike = {
  state: unknown;
  replaceState: (data: unknown, unused: string, url: string) => void;
};

/** Returns true when a one-time token was found and turned into a session. */
export async function verifyOneTimeTokenFromUrl(
  client: CrossDomainAuthActions,
  location: LocationLike,
  history: HistoryLike,
): Promise<boolean> {
  const url = new URL(location.href);
  const token = url.searchParams.get("ott");
  if (!token) return false;
  // Remove it first: a one-time token must never be retried or left in the address bar.
  url.searchParams.delete("ott");
  history.replaceState(history.state, "", url.toString());

  const result = await client.crossDomain.oneTimeToken.verify({ token }).catch(() => null);
  const session = result?.data?.session;
  if (!session) return false;
  await client.getSession({
    fetchOptions: { headers: { Authorization: `Bearer ${session.token}` } },
  });
  client.updateSession();
  return true;
}
