import { brand } from "@pantry/backend/brand";
import { DesignPage } from "@pantry/ui/design/design-page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: `Design system · ${brand.name}`,
  robots: { index: false, follow: false },
};

/**
 * Dev-only review surface for the design system (spec §9d). 404 in production builds unless
 * PANTRY_DESIGN_PAGE=1 is set.
 */
export default function DesignRoute() {
  if (process.env.NODE_ENV === "production" && process.env.PANTRY_DESIGN_PAGE !== "1") {
    notFound();
  }
  return (
    <DesignPage
      brand={{ name: brand.name, defaultKey: brand.defaultKey, tokenPrefix: brand.tokenPrefix }}
    />
  );
}
