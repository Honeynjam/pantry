import { cn } from "@pantry/ui/lib/utils";

/** A single key. Mono, 11px, a hairline keycap with a 1px bottom edge. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "border-border bg-gray-2 text-2xs text-muted-foreground pointer-events-none inline-flex h-[1.125rem] w-fit min-w-[1.125rem] items-center justify-center gap-0.5 rounded-sm border px-1 font-mono leading-none font-medium select-none",
        "shadow-[inset_0_-1px_0_var(--border)]",
        "in-data-[slot=tooltip-content]:text-background in-data-[slot=tooltip-content]:border-transparent in-data-[slot=tooltip-content]:bg-[color-mix(in_oklch,var(--background)_16%,transparent)] in-data-[slot=tooltip-content]:shadow-none",
        "in-[[data-slot=button][data-variant=default]]:text-primary-foreground in-[[data-slot=button][data-variant=default]]:border-[color-mix(in_oklch,var(--primary-foreground)_22%,transparent)] in-[[data-slot=button][data-variant=default]]:bg-[color-mix(in_oklch,var(--primary-foreground)_10%,transparent)] in-[[data-slot=button][data-variant=default]]:shadow-none",
        "[&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-0.5", className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
