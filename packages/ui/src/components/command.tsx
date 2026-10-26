"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { motion } from "motion/react";
import { SearchIcon, CheckIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pantry/ui/components/dialog";
import { cn } from "@pantry/ui/lib/utils";
import { spring, usePrefersReducedMotion } from "@pantry/ui/lib/motion";

/**
 * Command list (cmdk), with Arc's feel (spec §9d): the list frame springs to its height as results
 * change, and one highlight glides to the active row on the `morph` spring (arrow keys and hover),
 * snapping instead on long jumps. Ranking is the caller's (`shouldFilter={false}`).
 */
function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** The panel rises in on a spring (CSS `linear()` approximation of `morph`); exits fade fast. */
const paletteMotion = cn(
  "duration-(--spring-morph-duration) ease-(--ease-spring-morph)",
  "data-starting-style:translate-y-3 data-starting-style:scale-[0.97]",
);

function CommandDialog({
  title = "Command palette",
  description = "Search for an issue, project or action",
  children,
  className,
  showCloseButton = false,
  finalFocus,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
  /** Where focus goes on close (Base UI's `finalFocus`); default: back where it was. */
  finalFocus?: React.ComponentProps<typeof DialogContent>["finalFocus"];
  children: React.ReactNode;
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn("gap-0 overflow-hidden rounded-xl! p-0 sm:max-w-xl", paletteMotion, className)}
        showCloseButton={showCloseButton}
        finalFocus={finalFocus}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="flex h-11 items-center gap-2.5 border-b border-border px-3.5">
      <SearchIcon className="size-4 shrink-0 text-faint-foreground" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "h-full w-full bg-transparent text-base text-foreground outline-hidden placeholder:text-faint-foreground disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      />
    </div>
  );
}

/**
 * The scrolling results frame. Its height follows cmdk's `--cmdk-list-height` on the smooth spring
 * (instant with reduced motion); the highlight lives inside it.
 */
function CommandList({ className, children, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "h-[calc(var(--cmdk-list-height)+0.75rem)] max-h-80 scroll-py-1.5 overflow-x-hidden overflow-y-auto overscroll-contain p-1.5 outline-none",
        "transition-[height] duration-(--spring-smooth-duration) ease-(--ease-spring-smooth) motion-reduce:transition-none in-[.reduce-motion]:transition-none",
        "**:[[cmdk-list-sizer]]:relative",
        className,
      )}
      {...props}
    >
      <CommandHighlight />
      {children}
    </CommandPrimitive.List>
  );
}

type HighlightBox = { top: number; height: number; snap: boolean };

/**
 * One highlight for the whole list: it measures the active row (cmdk marks it `data-selected`) and
 * glides there; a jump of more than four rows snaps. Reduced motion: it's placed at once.
 */
function CommandHighlight() {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const [box, setBox] = React.useState<HighlightBox | null>(null);

  React.useLayoutEffect(() => {
    const sizer = ref.current?.parentElement;
    if (!sizer) return;
    let last: number | null = null;
    const measure = () => {
      const item = sizer.querySelector<HTMLElement>('[cmdk-item][data-selected="true"]');
      if (!item) {
        last = null;
        setBox(null);
        return;
      }
      const top = item.offsetTop;
      const height = item.offsetHeight;
      const snap = last === null || Math.abs(top - last) > height * 4;
      last = top;
      setBox((prev) => (prev && prev.top === top && prev.height === height ? prev : { top, height, snap }));
    };
    measure();
    const mutations = new MutationObserver(measure);
    mutations.observe(sizer, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-selected"] });
    const resize = new ResizeObserver(measure);
    resize.observe(sizer);
    return () => {
      mutations.disconnect();
      resize.disconnect();
    };
  }, []);

  return (
    <motion.div
      ref={ref}
      aria-hidden
      data-slot="command-highlight"
      className="pointer-events-none absolute inset-x-0 top-0 rounded-md bg-accent"
      initial={false}
      animate={box ? { y: box.top, height: box.height, opacity: 1 } : { opacity: 0 }}
      transition={reduce || box?.snap ? { duration: 0 } : spring.morph}
    />
  );
}

function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("py-8 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden text-foreground not-first:mt-1.5 **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pt-1 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-1.5 my-1.5 h-px bg-border", className)}
      {...props}
    />
  );
}

function CommandItem({ className, children, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "group/command-item relative flex h-8 cursor-default items-center gap-2.5 rounded-md px-2 text-sm text-foreground outline-hidden select-none",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:text-faint-foreground",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-selected:[&_svg:not([class*='text-'])]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <CheckIcon className="ml-auto hidden group-data-[checked=true]/command-item:block" />
    </CommandPrimitive.Item>
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("ml-auto flex items-center gap-0.5 font-mono text-2xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
