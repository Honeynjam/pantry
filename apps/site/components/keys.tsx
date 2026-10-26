"use client";

import * as React from "react";
import { Kbd, KbdGroup } from "@pantry/ui/components/kbd";
import { formatChord } from "@pantry/ui/components/keycap";
import { cn } from "@pantry/ui/lib/utils";

/** Marketing-size keycaps on the app's Kbd. Always Mac symbols: the page talks to Mac users first. */
export function Keys({ keys, size = "lg" }: { keys: string; size?: "md" | "lg" }) {
  return (
    <KbdGroup className="gap-1">
      {keys.split(" ").flatMap((chord, index) => [
        ...(index > 0
          ? [
              <span key={`then-${index}`} className="text-muted-foreground px-0.5 text-xs">
                then
              </span>,
            ]
          : []),
        ...formatChord(chord, true).map((key, keyIndex) => (
          <Kbd
            key={`${index}-${keyIndex}`}
            className={cn(
              "text-foreground",
              size === "lg" ? "h-8 min-w-8 rounded-md px-2 text-sm" : "h-6 min-w-6 px-1.5 text-xs",
            )}
          >
            {key}
          </Kbd>
        )),
      ])}
    </KbdGroup>
  );
}
