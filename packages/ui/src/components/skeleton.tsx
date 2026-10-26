import { cn } from "@pantry/ui/lib/utils";

/** Loading placeholder that holds the page's shape. The pulse stops under reduced motion. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-sm bg-gray-4 motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
