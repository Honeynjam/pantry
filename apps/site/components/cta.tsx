import * as React from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@pantry/ui/components/button";
import { cn } from "@pantry/ui/lib/utils";
import { hero, links } from "@/lib/content";
import { ConvexLogo, GitHubLogo, VercelLogo } from "./logos";

/** Marketing-size buttons on the app's button variants. Monochrome primary, like the app. */
const sizes = {
  sm: "h-8 rounded-full px-3.5 text-sm",
  lg: "h-11 rounded-full px-5 text-[0.9375rem] [&_svg:not([class*='size-'])]:size-4",
};

export function DeployButton({
  size = "lg",
  className,
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <a
      href={links.deploy}
      className={cn(
        buttonVariants({ variant: "default" }),
        sizes[size],
        "cursor-pointer gap-2",
        className,
      )}
    >
      <VercelLogo className="size-3.5" />
      {size === "sm" ? hero.primaryShort : hero.primary}
    </a>
  );
}

export function GitHubButton({ className }: { className?: string }) {
  return (
    <a
      href={links.repo}
      className={cn(
        buttonVariants({ variant: "outline" }),
        sizes.lg,
        "cursor-pointer gap-2",
        className,
      )}
    >
      <GitHubLogo />
      {hero.secondary}
      <ArrowUpRight className="text-muted-foreground size-3.5" />
    </a>
  );
}

export function DemoLink({ className }: { className?: string }) {
  if (!links.demo) return null;
  return (
    <a
      href={links.demo}
      className={cn(
        "group text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors",
        className,
      )}
    >
      {hero.demo}
      <ArrowRight className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
    </a>
  );
}

export function CtaRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <DeployButton />
      <GitHubButton />
    </div>
  );
}

/** "Free and MIT licensed. Runs on your own ▲ Vercel and ◆ Convex." */
export function RunsOn({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm",
        className,
      )}
    >
      {hero.runsOn}
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-foreground inline-flex items-center gap-1 font-medium">
          <VercelLogo className="size-3.5" />
          Vercel
        </span>
        and
        <span className="text-foreground inline-flex items-center gap-1 font-medium">
          <ConvexLogo className="size-3.5" />
          Convex
        </span>
      </span>
    </p>
  );
}
