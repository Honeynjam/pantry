import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@pantry/ui/lib/utils";

/**
 * Dense buttons: 28px default, 13px medium text, hairline borders, press scale from the motion
 * tokens. One amber `default` per view; everything else is secondary, ghost or outline.
 */
const buttonVariants = cva(
  [
    "group/button pressable relative inline-flex shrink-0 cursor-default items-center justify-center gap-1.5 rounded-md border border-transparent font-medium whitespace-nowrap select-none",
    "disabled:pointer-events-none disabled:text-faint-foreground aria-disabled:pointer-events-none",
    "aria-invalid:border-destructive",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground",
          "shadow-[inset_0_1px_0_oklch(1_0_0/0.25),0_0_0_1px_oklch(0.45_0.12_60/0.35)] dark:shadow-[inset_0_1px_0_oklch(1_0_0/0.25)]",
          "hover:bg-[color-mix(in_oklch,var(--primary),white_12%)] dark:hover:bg-[color-mix(in_oklch,var(--primary),white_10%)]",
          "disabled:bg-muted disabled:shadow-none",
        ].join(" "),
        secondary: [
          "bg-secondary text-secondary-foreground shadow-raised",
          "hover:bg-accent aria-expanded:bg-accent",
          "disabled:bg-muted disabled:shadow-none",
        ].join(" "),
        outline: [
          "border-border bg-transparent text-foreground",
          "hover:bg-accent aria-expanded:bg-accent",
        ].join(" "),
        ghost: [
          "text-muted-foreground",
          "hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
        ].join(" "),
        destructive: [
          "bg-destructive text-destructive-foreground",
          "hover:bg-[color-mix(in_oklch,var(--destructive),black_8%)]",
          "disabled:bg-muted",
        ].join(" "),
        link: "h-auto! px-0! text-primary-text underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-control px-2.5 text-sm has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        xs: "h-5 gap-1 rounded-sm px-1.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-control-sm gap-1 rounded-sm px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-control-lg px-3 text-sm has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-4",
        icon: "size-control [&_svg:not([class*='size-'])]:size-4",
        "icon-xs": "size-5 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-control-sm rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-control-lg [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
