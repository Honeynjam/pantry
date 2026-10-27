"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@pantry/ui/lib/utils";

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-3 data-horizontal:flex-col", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list relative isolate inline-flex w-fit items-center text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        /** Segmented: a raised pill glides between options. */
        default: "h-control gap-0.5 rounded-md bg-muted p-0.5",
        /** Underline: a 2px bar glides under the active tab. */
        line: "h-8 gap-3 border-b border-border",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

/**
 * The active indicator glides on the `morph` spring (CSS mirror of motion's spring.morph).
 * Reduced motion: it jumps; the colour change still marks the active tab.
 */
function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {children}
      <TabsPrimitive.Indicator
        data-slot="tabs-indicator"
        className={cn(
          "pointer-events-none absolute top-0 left-0 -z-10",
          "w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top)",
          "transition-[translate,width,height] duration-(--spring-morph-duration) ease-(--ease-spring-morph)",
          "in-[.reduce-motion]:transition-none motion-reduce:transition-none",
          "group-data-[variant=default]/tabs-list:bg-background group-data-[variant=default]/tabs-list:shadow-raised dark:group-data-[variant=default]/tabs-list:bg-gray-6 group-data-[variant=default]/tabs-list:h-(--active-tab-height) group-data-[variant=default]/tabs-list:rounded-sm",
          "group-data-[variant=line]/tabs-list:bg-foreground group-data-[variant=line]/tabs-list:top-auto group-data-[variant=line]/tabs-list:-bottom-px group-data-[variant=line]/tabs-list:h-0.5 group-data-[variant=line]/tabs-list:translate-y-0 group-data-[variant=line]/tabs-list:rounded-full",
        )}
      />
    </TabsPrimitive.List>
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-full flex-1 cursor-default items-center justify-center gap-1.5 rounded-sm px-2 text-sm font-medium whitespace-nowrap select-none",
        "text-muted-foreground hover:text-foreground data-active:text-foreground transition-colors duration-(--duration-instant)",
        "group-data-[variant=line]/tabs-list:px-0.5",
        "group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start",
        "disabled:text-faint-foreground disabled:pointer-events-none aria-disabled:pointer-events-none",
        "focus-visible:outline-offset-0",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
