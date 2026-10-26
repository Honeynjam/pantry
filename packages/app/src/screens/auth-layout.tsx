import { brand } from "@pantry/backend/brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pantry/ui/components/card";
import { LogoMark } from "@pantry/ui/components/logo-mark";
import type { ReactNode } from "react";

/**
 * Centred card on a subtle surface (adapted from shadcn's login-03 block): product mark, title,
 * one form, and a footer line for the alternative path.
 */
export function AuthLayout({
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-gray-2 p-6 md:p-10 dark:bg-background">
      <div className={wide ? "flex w-full max-w-md flex-col gap-6" : "flex w-full max-w-sm flex-col gap-6"}>
        <div className="flex items-center gap-2 self-center">
          <LogoMark name={brand.name} />
          <span className="font-display text-sm font-semibold tracking-[-0.01em] text-foreground">{brand.name}</span>
        </div>
        <Card>
          <CardHeader className="gap-1.5 text-center">
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}
