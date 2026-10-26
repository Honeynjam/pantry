import { brand } from "@pantry/backend/brand";
import { themeInitScript } from "@pantry/ui/lib/theme-script";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

const THEME_STORAGE_KEY = `${brand.name.toLowerCase()}-theme`;

export const metadata: Metadata = {
  title: brand.name,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfdfd" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0c" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript(THEME_STORAGE_KEY) }} />
      </head>
      <body>
        <Providers themeStorageKey={THEME_STORAGE_KEY}>{children}</Providers>
      </body>
    </html>
  );
}
