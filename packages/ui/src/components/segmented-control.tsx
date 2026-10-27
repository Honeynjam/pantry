"use client";

import * as React from "react";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { motion } from "motion/react";
import { cn } from "@pantry/ui/lib/utils";
import { spring, useMotionTransition } from "@pantry/ui/lib/motion";

export type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Accessible name when the label is icon-only. */
  ariaLabel?: string;
};

/**
 * Single choice among 2–5 options (theme switcher, list/board toggle). The highlight glides between
 * options on the `morph` spring via a shared layoutId; with reduced motion it cross-fades in place.
 */
function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  size = "default",
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  size?: "sm" | "default";
  className?: string;
  "aria-label"?: string;
}) {
  const layoutId = React.useId();
  const transition = useMotionTransition(spring.morph);
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      aria-label={ariaLabel}
      data-slot="segmented-control"
      data-size={size}
      className={cn(
        "bg-muted relative inline-flex w-fit items-center gap-0.5 rounded-md p-0.5",
        size === "sm" ? "h-control-sm" : "h-control",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Radio.Root
            key={option.value}
            value={option.value}
            aria-label={option.ariaLabel}
            className={cn(
              "relative flex h-full cursor-default items-center justify-center gap-1.5 rounded-sm px-2 font-medium whitespace-nowrap select-none",
              "text-muted-foreground hover:text-foreground data-checked:text-foreground transition-colors duration-(--duration-instant)",
              "focus-visible:outline-offset-0",
              "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
              size === "sm" ? "text-xs" : "text-sm",
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                transition={transition}
                aria-hidden
                className="bg-background shadow-raised dark:bg-gray-6 absolute inset-0 rounded-sm"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </Radio.Root>
        );
      })}
    </RadioGroup>
  );
}

export { SegmentedControl };
