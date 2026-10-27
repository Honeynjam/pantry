"use client";

import { useEffect, useState } from "react";
import { STALL_AFTER_MS } from "./loading";

/** Shown under a form whose submit has been pending for a while. */
export function SlowHint({ pending }: { pending: boolean }) {
  // Mounted only while pending, so the timer starts fresh on every submit.
  return pending ? <SlowHintAfterDelay /> : null;
}

function SlowHintAfterDelay() {
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setStalled(true), STALL_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!stalled) return null;
  return (
    <p role="status" className="text-muted-foreground text-center text-xs">
      This is taking longer than usual.{" "}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="text-foreground decoration-gray-8 underline underline-offset-4 hover:decoration-current"
      >
        Reload
      </button>
    </p>
  );
}
