"use client";

import { NavigationProvider, PantryProviders, type LinkProps, type Navigation } from "@pantry/app";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { getConvexUrl } from "@/lib/convex-env";
import { MissingConvexUrl } from "./missing-convex-url";

function Link({ href, ...props }: LinkProps) {
  return <NextLink href={href} {...props} />;
}

/** Client-only root for the app routes: Convex + Better Auth, and Next.js routing for packages/app. */
export default function ClientApp({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useMemo<Navigation>(
    () => ({
      pathname,
      navigate: (to, options) => (options?.replace ? router.replace(to) : router.push(to)),
      Link,
    }),
    [pathname, router],
  );

  const convexUrl = getConvexUrl();
  if (!convexUrl) return <MissingConvexUrl />;
  return (
    <PantryProviders convexUrl={convexUrl}>
      <NavigationProvider value={navigation}>{children}</NavigationProvider>
    </PantryProviders>
  );
}
