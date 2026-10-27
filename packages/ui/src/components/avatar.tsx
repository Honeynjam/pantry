import * as React from "react";
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "@pantry/ui/lib/utils";

type AvatarSize = "xs" | "sm" | "default" | "lg";

/** Round avatar with a hairline inner edge. xs 16 / sm 20 / default 24 / lg 32. */
function Avatar({
  className,
  size = "default",
  ...props
}: AvatarPrimitive.Root.Props & { size?: AvatarSize }) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-6 shrink-0 rounded-full select-none",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:border after:border-[oklch(0_0_0/0.08)] dark:after:border-[oklch(1_0_0/0.08)]",
        "data-[size=lg]:size-8 data-[size=sm]:size-5 data-[size=xs]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full rounded-full object-cover", className)}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-gray-5 text-gray-11 flex size-full items-center justify-center rounded-full font-medium uppercase",
        "text-[0.625rem] group-data-[size=lg]/avatar:text-xs group-data-[size=sm]/avatar:text-[0.5625rem] group-data-[size=xs]/avatar:text-[0.5rem]",
        className,
      )}
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "bg-success ring-background absolute -right-px -bottom-px z-10 inline-flex size-2 items-center justify-center rounded-full ring-2 select-none",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group *:data-[slot=avatar]:ring-background flex -space-x-1 *:data-[slot=avatar]:ring-2",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroupCount({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "bg-gray-4 text-muted-foreground tabular ring-background relative flex size-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-medium ring-2",
        "group-has-data-[size=lg]/avatar-group:size-8 group-has-data-[size=sm]/avatar-group:size-5 group-has-data-[size=xs]/avatar-group:size-4 group-has-data-[size=xs]/avatar-group:text-[0.5rem]",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge };
