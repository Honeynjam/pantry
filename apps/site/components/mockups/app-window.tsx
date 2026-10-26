import * as React from "react";
import { cn } from "@pantry/ui/lib/utils";

/** A macOS-style window frame for product mockups: traffic lights, an optional title, hairline edge. */
export function AppWindow({
  title,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("window-frame overflow-hidden", className)}>
      <div className="border-border bg-gray-2 relative flex h-9 items-center border-b px-3.5">
        <div aria-hidden className="flex gap-2">
          <span className="bg-gray-6 size-3 rounded-full" />
          <span className="bg-gray-6 size-3 rounded-full" />
          <span className="bg-gray-6 size-3 rounded-full" />
        </div>
        {title && (
          <div className="text-muted-foreground absolute inset-x-0 text-center font-mono text-xs">
            {title}
          </div>
        )}
      </div>
      <div className={cn("relative", bodyClassName)}>{children}</div>
    </div>
  );
}

/** Mockups are pictures of the product: hide their contents from assistive tech, describe them once. */
export function Mockup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure role="img" aria-label={label} className={cn("select-none", className)}>
      <div aria-hidden inert className="pointer-events-none">
        {children}
      </div>
    </figure>
  );
}
