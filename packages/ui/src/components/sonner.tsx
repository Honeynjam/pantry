"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react";
import { useTheme } from "@pantry/ui/lib/theme";

/** Toasts on the overlay surface; colour only in the icon. */
function Toaster({ ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      gap={8}
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-muted-foreground" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-lg)",
          "--font-family": "var(--font-body)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "pantry-toast gap-2.5! px-3! py-2.5! text-sm! shadow-overlay! border-0! font-sans",
          title: "font-medium!",
          description: "text-xs! text-muted-foreground!",
          actionButton: "h-6! rounded-sm! bg-primary! px-2! text-xs! font-medium! text-primary-foreground!",
          cancelButton: "h-6! rounded-sm! bg-secondary! px-2! text-xs! text-secondary-foreground!",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
