"use client";

import * as React from "react";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@pantry/ui/lib/utils";
import { toggleVariants } from "@pantry/ui/components/toggle";

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants>>({
  size: "default",
  variant: "default",
});

/** A row of toggles (multi-select toolbars). For a single choice with a gliding highlight, use SegmentedControl. */
function ToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}: ToggleGroupPrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn("group/toggle-group flex w-fit items-center gap-0.5", className)}
      {...props}
    >
      <ToggleGroupContext value={{ variant, size }}>{children}</ToggleGroupContext>
    </ToggleGroupPrimitive>
  );
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext);
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        "shrink-0 focus-visible:z-10",
        toggleVariants({ variant: context.variant || variant, size: context.size || size }),
        className,
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  );
}

export { ToggleGroup, ToggleGroupItem };
