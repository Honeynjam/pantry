"use client";

import { Button } from "@pantry/ui/components/button";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState, type ComponentProps } from "react";

/** Copies `text`; the icon swaps to a check for a moment. Pass children for a labelled button. */
export function CopyButton({
  text,
  label,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick"> & { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      type="button"
      size={children ? "sm" : "icon-sm"}
      variant="ghost"
      aria-label={children ? undefined : copied ? "Copied" : label}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
      {...props}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {children && <span aria-live="polite">{copied ? "Copied" : children}</span>}
    </Button>
  );
}
