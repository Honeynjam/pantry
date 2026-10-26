"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@pantry/ui/components/popover";
import { LABEL_COLORS, resolveLabelColor } from "@pantry/ui/lib/issue-meta";
import { focusRing } from "@pantry/ui/lib/styles";
import { cn } from "@pantry/ui/lib/utils";

const NAMES: Record<string, string> = Object.fromEntries(
  LABEL_COLORS.map((color) => [color, color[0]!.toUpperCase() + color.slice(1)]),
);

/**
 * A colour dot that opens the curated palette (label and status colours). `value` is a palette name
 * or a stored hex; `extra` adds swatches such as a status category's default colour.
 */
function ColorPicker({
  value,
  onChange,
  label,
  extra = [],
  className,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
  extra?: { value: string; name: string }[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const swatches = [...extra, ...LABEL_COLORS.map((color) => ({ value: color, name: NAMES[color]! }))];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`${label}: ${swatches.find((swatch) => swatch.value === value)?.name ?? value}`}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-sm transition-colors duration-(--duration-instant) hover:bg-accent aria-expanded:bg-accent",
          focusRing,
          className,
        )}
      >
        <span className="size-2.5 rounded-full" style={{ background: resolveLabelColor(value) }} aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-0 p-1.5">
        <div role="radiogroup" aria-label={label} className="grid grid-cols-6 gap-0.5">
          {swatches.map((swatch) => {
            const selected = swatch.value === value;
            return (
              <button
                key={swatch.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={swatch.name}
                title={swatch.name}
                onClick={() => {
                  onChange(swatch.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex size-7 items-center justify-center rounded-sm transition-colors duration-(--duration-instant) hover:bg-accent",
                  focusRing,
                )}
              >
                <span
                  className="flex size-4 items-center justify-center rounded-full"
                  style={{ background: resolveLabelColor(swatch.value) }}
                >
                  {selected && <CheckIcon className="size-3 text-white" strokeWidth={3} aria-hidden />}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { ColorPicker };
