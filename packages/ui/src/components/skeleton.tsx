import { cn } from "@pantry/ui/lib/utils";

/** Loading placeholder that holds the page's shape. The pulse stops under reduced motion. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-gray-4 animate-pulse rounded-sm motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
