"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@pantry/ui/lib/utils";
import { usePortalContainer } from "@pantry/ui/lib/portal";
import { overlaySurface, popupMotion } from "@pantry/ui/lib/styles";

function Popover<Payload = unknown>({ ...props }: PopoverPrimitive.Root.Props<Payload>) {
  return <PopoverPrimitive.Root<Payload> data-slot="popover" {...props} />;
}

function PopoverTrigger<Payload = unknown>({ ...props }: PopoverPrimitive.Trigger.Props<Payload>) {
  return <PopoverPrimitive.Trigger<Payload> data-slot="popover-trigger" {...props} />;
}

/** One popover for many triggers (Base UI detached triggers); see createDropdownMenuHandle. */
const createPopoverHandle = PopoverPrimitive.createHandle;
type PopoverHandle<Payload> = PopoverPrimitive.Handle<Payload>;

function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 6,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  const container = usePortalContainer();
  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 flex w-72 flex-col gap-3 p-3 text-sm outline-hidden",
            overlaySurface,
            "rounded-xl",
            popupMotion,
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="popover-header" className={cn("flex flex-col gap-0.5", className)} {...props} />;
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  );
}

function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  createPopoverHandle,
  type PopoverHandle,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
