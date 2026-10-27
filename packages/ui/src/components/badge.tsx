import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@pantry/ui/lib/utils";

/**
 * A badge is a count or a state, not a category (use LabelChip for labels).
 * Square-ish, 18px, 11px medium text, mostly neutral.
 */
const badgeVariants = cva(
  [
    "group/badge inline-flex h-[1.125rem] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border px-1.5 text-2xs font-medium whitespace-nowrap tabular",
    "[&>svg]:pointer-events-none [&>svg]:size-3!",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary-subtle text-foreground",
        secondary: "border-transparent bg-secondary text-muted-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        solid: "border-transparent bg-foreground text-background",
        success:
          "border-transparent bg-[color-mix(in_oklch,var(--success)_14%,transparent)] text-success",
        warning:
          "border-transparent bg-[color-mix(in_oklch,var(--warning)_16%,transparent)] text-[color-mix(in_oklch,var(--warning),var(--foreground)_25%)]",
        destructive:
          "border-transparent bg-[color-mix(in_oklch,var(--destructive)_12%,transparent)] text-destructive",
        ghost: "border-transparent text-muted-foreground",
        link: "border-transparent px-0 text-primary-text underline decoration-gray-8 underline-offset-4 hover:decoration-current",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  },
);

function Badge({
  className,
  variant = "secondary",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(badgeVariants({ variant }), className) }, props),
    render,
    state: { slot: "badge", variant },
  });
}

export { Badge, badgeVariants };
