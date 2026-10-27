import * as React from "react";
import { fieldChrome } from "@pantry/ui/components/input";
import { cn } from "@pantry/ui/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldChrome,
        "flex field-sizing-content min-h-16 resize-none px-2 py-1.5",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
