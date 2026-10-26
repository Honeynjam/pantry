import * as React from "react";
import { cn } from "@pantry/ui/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-xs leading-none font-medium text-foreground select-none",
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:text-faint-foreground peer-disabled:cursor-not-allowed peer-disabled:text-faint-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
