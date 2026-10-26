import { cn } from "@pantry/ui/lib/utils";
import type { ComponentProps, ReactNode } from "react";

/** One settings page: title, one-line description, then its groups. */
export function SettingsPanel({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-8">
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

/** A titled block inside a settings page. */
export function SettingsGroup({
  title,
  hint,
  actions,
  children,
  className,
}: {
  title: string;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)} aria-label={title}>
      <div className="flex min-h-6 items-center gap-2">
        <h2 className="font-sans text-xs font-medium tracking-normal text-muted-foreground">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Hairline-bordered list of dense rows. */
export function SettingsList({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border", className)}
      {...props}
    />
  );
}

export function SettingsRow({ className, ...props }: ComponentProps<"li">) {
  return <li className={cn("flex min-h-row items-center gap-3 px-3 py-1 text-sm", className)} {...props} />;
}

/** Quiet empty line inside a list. */
export function SettingsEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
