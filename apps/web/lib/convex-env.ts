/** Convex URLs inlined at build time (see next.config.ts and scripts/vercel-build.sh). Read per call. */
export const getConvexUrl = () => process.env.NEXT_PUBLIC_CONVEX_URL || undefined;
export const getConvexSiteUrl = () => process.env.NEXT_PUBLIC_CONVEX_SITE_URL || undefined;
