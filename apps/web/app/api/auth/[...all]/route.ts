import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { getConvexSiteUrl, getConvexUrl } from "@/lib/convex-env";

// Better Auth runs inside Convex; this route proxies /api/auth/* to the deployment's .convex.site URL
// so session cookies stay first-party. Created lazily so a build without Convex env still succeeds.
let handler: ReturnType<typeof convexBetterAuthNextJs>["handler"] | undefined;

function getHandler() {
  const convexUrl = getConvexUrl();
  const convexSiteUrl = getConvexSiteUrl();
  if (!convexUrl || !convexSiteUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL / NEXT_PUBLIC_CONVEX_SITE_URL are not set");
  }
  handler ??= convexBetterAuthNextJs({ convexUrl, convexSiteUrl }).handler;
  return handler;
}

export const GET = (request: Request) => getHandler().GET(request);
export const POST = (request: Request) => getHandler().POST(request);
