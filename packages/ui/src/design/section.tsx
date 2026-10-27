import * as React from "react";
import { cn } from "@pantry/ui/lib/utils";

/** Building blocks for the /design review page (dev only). */

/** Prefix for anchor ids, so the light and dark panes don't share ids. */
export const SectionIdPrefix = React.createContext("");

export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  const prefix = React.useContext(SectionIdPrefix);
  const anchor = `${prefix}${id}`;
  return (
    <section
      id={anchor}
      aria-labelledby={`${anchor}-title`}
      className="border-border scroll-mt-16 border-t pt-8 pb-12 first:border-t-0 first:pt-0"
    >
      <header className="mb-6 flex max-w-[65ch] flex-col gap-1">
        <h2 id={`${anchor}-title`} className="text-foreground text-xl font-semibold">
          {title}
        </h2>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </header>
      <div className="flex flex-col gap-8">{children}</div>
    </section>
  );
}

export function SubSection({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-foreground font-sans text-sm font-medium tracking-normal">{title}</h3>
        {hint && <span className="text-2xs text-muted-foreground font-mono">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** A framed specimen area: hairline border, subtle background, padding. */
export function Specimen({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "border-border bg-background flex flex-wrap items-center gap-3 rounded-lg border p-4",
          className,
        )}
      >
        {children}
      </div>
      {label && <span className="text-2xs text-muted-foreground font-mono">{label}</span>}
    </div>
  );
}

export function TokenName({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <code className={cn("text-2xs text-muted-foreground font-mono", className)}>{children}</code>
  );
}
