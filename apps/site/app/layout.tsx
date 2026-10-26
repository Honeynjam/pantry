import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { brandName, hero } from "@/lib/content";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const title = `${brandName}: the issue tracker for small teams and their agents`;

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title,
  description: hero.lede,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: brandName, title, description: hero.lede, url: "/" },
  twitter: { card: "summary_large_image", title, description: hero.lede },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfdfd" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0c" },
  ],
  colorScheme: "light dark",
};

/** Each section sets its own theme (light or dark bands); the root is light. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="text-body">{children}</body>
    </html>
  );
}
