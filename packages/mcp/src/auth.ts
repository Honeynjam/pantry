import type { AuthInfo } from "@modelcontextprotocol/server";
import { api } from "@pantry/backend/api";
import { shouldTouch } from "@pantry/backend/tokens";
import type { Backend } from "./backend";

/** What the route learns about a token and hands to every tool in `authInfo.extra`. */
export type PantryAuthExtra = {
  tokenId: string;
  memberId: string;
  workspaceId: string;
  userId: string;
  displayName: string;
  /** This instance's web origin, for issue links in tool results. */
  appUrl: string;
};

/**
 * `verifyToken` for `withMcpAuth`: asks Convex who the bearer token acts as (`mcp.verifyToken`
 * hashes and checks it). Unknown or revoked → undefined, which `withMcpAuth({ required: true })`
 * turns into a 401. `lastUsedAt` is written by a separate mutation, only when it's over 10 minutes
 * old (the mutation checks again, so races are harmless); a failed write never blocks the call.
 */
export function createVerifyToken(
  backend: Backend,
  { appUrl, now = Date.now }: { appUrl: (req: Request) => string; now?: () => number },
) {
  return async (req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
    const token = bearerToken?.trim();
    if (!token) return undefined;
    const owner = await backend.query(api.mcp.verifyToken, { token });
    if (!owner) return undefined;
    if (shouldTouch(owner.lastUsedAt ?? undefined, now())) {
      try {
        await backend.mutation(api.mcp.touchToken, { token });
      } catch (err) {
        console.error("Couldn't record API token use:", err);
      }
    }
    const extra: PantryAuthExtra = {
      tokenId: owner.tokenId,
      memberId: owner.memberId,
      workspaceId: owner.workspaceId,
      userId: owner.userId,
      displayName: owner.displayName,
      appUrl: appUrl(req).replace(/\/+$/, ""),
    };
    return { token, clientId: owner.tokenId, scopes: [], extra };
  };
}
