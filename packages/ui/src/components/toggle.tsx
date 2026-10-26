"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@pantry/ui/lib/utils";

const toggleVariants = cva(
  [
    "group/toggle pressable inline-flex cursor-default items-center justify-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap text-muted-foreground",
    "hover:bg-accent hover:text-foreground",
    "data-pressed:bg-selected data-pressed:text-foreground",
    "disabled:pointer-events-none disabled:text-faint-foreground",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-border bg-transparent",
      },
      size: {
        default: "h-control min-w-control px-2",
        sm: "h-control-sm min-w-control-sm rounded-sm px-1.5 text-xs",
        lg: "h-control-lg min-w-control-lg px-2.5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
