import * as React from "react";
import { cn } from "@pantry/ui/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-foreground flex items-center gap-2 text-xs leading-none font-medium select-none",
        "group-data-[disabled=true]:text-faint-foreground peer-disabled:text-faint-foreground group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
