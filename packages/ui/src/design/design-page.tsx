"use client";

import * as React from "react";
import { MotionConfig } from "motion/react";
import { Columns2Icon, MonitorIcon, MoonIcon, SquareIcon, SunIcon } from "lucide-react";
import { Badge } from "@pantry/ui/components/badge";
import { SegmentedControl } from "@pantry/ui/components/segmented-control";
import { Toggle } from "@pantry/ui/components/toggle";
import { PortalContainerProvider } from "@pantry/ui/lib/portal";
import { useTheme, type Theme } from "@pantry/ui/lib/theme";
import { cn } from "@pantry/ui/lib/utils";
import { DesignBrandProvider, type DesignBrand } from "./brand";
import { ComponentsSection } from "./components-demo";
import { CompositionSection, PartsSection } from "./composition";
import { ColorSection, LayoutSection, TypeSection } from "./foundations";
import { MotionSection } from "./motion-demos";
import { SectionIdPrefix } from "./section";

const NAV = [
  { id: "colour", label: "Colour" },
  { id: "type", label: "Typography" },
  { id: "layout", label: "Shape and density" },
  { id: "motion", label: "Motion" },
  { id: "components", label: "Components" },
  { id: "parts", label: "Pantry parts" },
  { id: "in-context", label: "In context" },
];

function Showcase({ idPrefix = "" }: { idPrefix?: string }) {
  // The nav targets the unprefixed (first) pane.
  return (
    <SectionIdPrefix value={idPrefix}>
      <div className="flex flex-col">
        <ColorSection />
        <TypeSection />
        <LayoutSection />
        <MotionSection />
        <ComponentsSection />
        <PartsSection />
        <CompositionSection />
      </div>
    </SectionIdPrefix>
  );
}

/** A subtree forced to one theme; its popups portal into it so they match. */
function ThemePane({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);
  return (
    <div
      className={cn(theme, "bg-background text-foreground min-w-0 px-6 py-8")}
      data-theme-pane={theme}
    >
      <div className="mb-6 flex items-center gap-2">
        {theme === "light" ? (
          <SunIcon className="text-muted-foreground size-3.5" />
        ) : (
          <MoonIcon className="text-muted-foreground size-3.5" />
        )}
        <span className="text-muted-foreground text-xs font-medium capitalize">{theme}</span>
      </div>
      <PortalContainerProvider container={container}>{children}</PortalContainerProvider>
      <div ref={setContainer} className={theme} />
    </div>
  );
}

/**
 * The dev-only /design review page: every token and component, in light and dark.
 * Rendered by apps/web/app/design/page.tsx.
 */
export function DesignPage({ brand }: { brand: DesignBrand }) {
  const { theme, setTheme } = useTheme();
  const [layout, setLayout] = React.useState<"single" | "split">("single");
  const [reduceMotion, setReduceMotion] = React.useState(false);

  return (
    <DesignBrandProvider value={brand}>
      <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
        <div
          className={cn("bg-background text-foreground min-h-svh", reduceMotion && "reduce-motion")}
        >
          <header className="border-border bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
            <div className="flex h-12 items-center gap-3 px-4">
              <span className="bg-primary font-display text-primary-foreground flex size-6 items-center justify-center rounded-md text-xs font-semibold">
                {brand.name[0]}
              </span>
              <span className="font-display text-sm font-semibold tracking-[-0.01em]">
                {brand.name}
              </span>
              <span className="text-faint-foreground text-sm">/</span>
              <span className="text-muted-foreground text-sm">Design system</span>
              <Badge variant="outline" className="hidden sm:inline-flex">
                dev only · M1 review
              </Badge>
              <div className="ml-auto flex items-center gap-2">
                <Toggle
                  size="sm"
                  variant="outline"
                  pressed={reduceMotion}
                  onPressedChange={setReduceMotion}
                  aria-label="Preview reduced motion"
                >
                  Reduce motion
                </Toggle>
                <SegmentedControl
                  size="sm"
                  aria-label="Layout"
                  value={layout}
                  onValueChange={setLayout}
                  options={[
                    { value: "single", label: "Single", icon: <SquareIcon /> },
                    { value: "split", label: "Light + dark", icon: <Columns2Icon /> },
                  ]}
                />
                <SegmentedControl<Theme>
                  size="sm"
                  aria-label="Theme"
                  value={theme}
                  onValueChange={setTheme}
                  options={[
                    {
                      value: "system",
                      label: "",
                      icon: <MonitorIcon />,
                      ariaLabel: "System theme",
                    },
                    { value: "light", label: "", icon: <SunIcon />, ariaLabel: "Light theme" },
                    { value: "dark", label: "", icon: <MoonIcon />, ariaLabel: "Dark theme" },
                  ]}
                />
              </div>
            </div>
          </header>

          <div className="flex">
            <nav
              aria-label="Sections"
              className="border-border sticky top-12 hidden h-[calc(100svh-3rem)] w-52 shrink-0 flex-col gap-0.5 border-r p-3 lg:flex"
            >
              {NAV.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-7 items-center rounded-md px-2 text-sm transition-colors duration-(--duration-instant)"
                >
                  {item.label}
                </a>
              ))}
              <p className="text-2xs text-muted-foreground mt-auto px-2 leading-4">
                Tokens: packages/ui/src/styles/globals.css. Motion: packages/ui/src/lib/motion.ts.
              </p>
            </nav>

            <main className="min-w-0 flex-1">
              {layout === "single" ? (
                <div className="mx-auto max-w-[68rem] px-6 py-10">
                  <Intro />
                  <Showcase />
                </div>
              ) : (
                <>
                  <div className="border-border border-b px-6 py-6">
                    <Intro compact />
                  </div>
                  <div className="divide-border grid grid-cols-1 xl:grid-cols-2 xl:divide-x">
                    <ThemePane theme="light">
                      <Showcase />
                    </ThemePane>
                    <ThemePane theme="dark">
                      <Showcase idPrefix="dark-" />
                    </ThemePane>
                  </div>
                </>
              )}
            </main>
          </div>
        </div>
      </MotionConfig>
    </DesignBrandProvider>
  );
}

function Intro({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex max-w-[65ch] flex-col gap-2", !compact && "mb-12")}>
      <h1
        className={cn(
          "font-display text-foreground font-semibold tracking-[-0.025em]",
          compact ? "text-xl" : "text-3xl",
        )}
      >
        Dense, quiet, keyboard-first
      </h1>
      <p className="text-muted-foreground text-base">
        Plane&apos;s three-zone density, MonoCode&apos;s monochrome and Linear&apos;s restraint.
        Greys do the structure, the primary action is simply the highest-contrast thing on screen,
        and colour only appears where it means something: status, priority and the label colours you
        pick.
      </p>
    </div>
  );
}
