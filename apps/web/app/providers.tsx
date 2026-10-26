"use client";

import { Toaster } from "@pantry/ui/components/sonner";
import { TooltipProvider } from "@pantry/ui/components/tooltip";
import { ThemeProvider } from "@pantry/ui/lib/theme";
import type { ReactNode } from "react";

export function Providers({ children, themeStorageKey }: { children: ReactNode; themeStorageKey: string }) {
  return (
    <ThemeProvider storageKey={themeStorageKey}>
      <TooltipProvider>
        {children}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
