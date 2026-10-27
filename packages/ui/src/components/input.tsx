import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@pantry/ui/lib/utils";

/** Shared field chrome for inputs and textareas: hairline border, focus shifts the border. */
export const fieldChrome = [
  "w-full min-w-0 rounded-md border border-input bg-background text-sm text-foreground",
  "transition-[border-color,box-shadow] duration-(--duration-instant) ease-(--ease-out)",
  "placeholder:text-faint-foreground",
  "hover:border-border-strong dark:bg-gray-2",
  "focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_22%,transparent)] focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:text-faint-foreground",
  "aria-invalid:border-destructive aria-invalid:focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--destructive)_20%,transparent)]",
].join(" ");

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        fieldChrome,
        "h-control px-2",
        "file:text-foreground file:mr-2 file:inline-flex file:h-5 file:border-0 file:bg-transparent file:text-xs file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
