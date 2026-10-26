"use client";

import { Button } from "@pantry/ui/components/button";
import { LogoMark } from "@pantry/ui/components/logo-mark";
import { brand } from "@pantry/backend/brand";
import { useEffect, useRef, useState } from "react";

/** After this long the loading screen offers a reload, so no stuck state can strand anyone. */
export const STALL_AFTER_MS = 8_000;

/**
 * Blank while auth and data resolve; a quiet hint appears after 400ms. If it's still loading after
 * STALL_AFTER_MS, it says so calmly, offers a reload, and logs `diagnostics()` for debugging.
 */
export function LoadingScreen({ diagnostics }: { diagnostics?: () => unknown }) {
  const [stalled, setStalled] = useState(false);
  const diagnosticsRef = useRef(diagnostics);
  useEffect(() => {
    diagnosticsRef.current = diagnostics;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setStalled(true);
      console.warn(`[${brand.name.toLowerCase()}] still loading after ${STALL_AFTER_MS / 1000}s`, diagnosticsRef.current?.());
    }, STALL_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  if (stalled) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6" role="status" aria-live="polite">
        <div className="flex max-w-xs animate-in flex-col items-center gap-3 text-center duration-(--duration-standard) fade-in motion-reduce:animate-none">
          <LogoMark name={brand.name} />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">This is taking longer than usual</p>
            <p className="text-sm text-muted-foreground">
              {brand.name} is still waiting for the server. Reloading usually sorts it out.
            </p>
          </div>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background" aria-busy="true">
      <span className="animate-in text-sm text-muted-foreground delay-400 duration-(--duration-standard) fill-mode-both fade-in motion-reduce:animate-none">
        Loading…
      </span>
    </div>
  );
}
