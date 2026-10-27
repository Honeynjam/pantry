import { api } from "@pantry/backend/api";
import { brand } from "@pantry/backend/brand";
import { MIN_APP_VERSION, SERVER_VERSION } from "@pantry/backend/version";
import { ConvexHttpClient } from "convex/browser";
import { getConvexSiteUrl, getConvexUrl } from "@/lib/convex-env";

export const dynamic = "force-dynamic";

const headers = {
  "cache-control": "no-store",
  // Public and non-secret: the Mac app reads it from its own origin before signing in.
  "access-control-allow-origin": "*",
};

export type InstanceInfo = {
  name: string;
  convexUrl: string;
  convexSiteUrl: string;
  serverVersion: string;
  minAppVersion: string;
  needsSecret: boolean;
};

/**
 * What a client needs to connect to this instance (spec §10): product name, Convex URLs, versions,
 * and whether the deployment still lacks BETTER_AUTH_SECRET (the setup screen shows the fix).
 */
export async function GET() {
  const convexUrl = getConvexUrl();
  const convexSiteUrl = getConvexSiteUrl();
  if (!convexUrl || !convexSiteUrl) {
    return Response.json(
      {
        error:
          "This server was built without NEXT_PUBLIC_CONVEX_URL; see the README troubleshooting list.",
      },
      { status: 503, headers },
    );
  }
  let needsSecret: boolean;
  try {
    const status = await new ConvexHttpClient(convexUrl).query(api.setup.status, {});
    needsSecret = status.needsSecret;
  } catch {
    return Response.json(
      { error: "Can't reach this server's Convex deployment." },
      { status: 503, headers },
    );
  }
  const body: InstanceInfo = {
    name: brand.name,
    convexUrl,
    convexSiteUrl,
    serverVersion: SERVER_VERSION,
    minAppVersion: MIN_APP_VERSION,
    needsSecret,
  };
  return Response.json(body, { headers });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...headers, "access-control-allow-methods": "GET, OPTIONS" },
  });
}
