/**
 * The site's public origin, for canonical URLs, social cards, robots and the sitemap.
 * Set NEXT_PUBLIC_SITE_URL once the domain is live; until then Vercel's production URL is used
 * (VERCEL_PROJECT_PRODUCTION_URL is the custom domain once one is attached), then localhost.
 */
export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3002"),
);
