"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";
import { cn } from "@pantry/ui/lib/utils";
import { focusRing } from "@pantry/ui/lib/styles";

/** A 14px square: hairline when empty, the monochrome primary when checked or mixed. */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-3.5 shrink-0 cursor-default items-center justify-center rounded-[4px] border border-gray-8 bg-background outline-none",
        "transition-[background-color,border-color] duration-(--duration-instant)",
        "data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
        "data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground",
        "data-disabled:opacity-50",
        // A bigger hit area than the 14px box.
        "after:absolute after:-inset-1.5",
        focusRing,
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current [&>svg]:size-3"
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>{state.indeterminate ? <MinusIcon strokeWidth={3} /> : <CheckIcon strokeWidth={3} />}</span>
        )}
      />
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
