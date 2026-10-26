import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { brandName, hero } from "@/lib/content";
import "./globals.css";

export const metadata: Metadata = {
  title: `${brandName}: the issue tracker for small teams and their agents`,
  description: hero.lede,
  openGraph: { title: brandName, description: hero.lede, type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#fdfdfd",
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
