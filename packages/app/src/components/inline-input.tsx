"use client";

import { Input } from "@pantry/ui/components/input";
import { cn } from "@pantry/ui/lib/utils";
import { useState, type ComponentProps } from "react";

/**
 * A name that edits in place: looks like text until hovered or focused. Saves on Enter or blur when
 * it changed and isn't empty; Esc puts the old value back.
 */
export function InlineInput({
  value,
  onSave,
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "defaultValue"> & {
  value: string;
  onSave: (next: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const shown = editing ? draft : value;

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) void onSave(next);
    else setDraft(value);
  }

  return (
    <Input
      value={shown}
      onFocus={() => {
        setDraft(value);
        setEditing(true);
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setDraft(value);
          setEditing(false);
          requestAnimationFrame(() => (event.target as HTMLInputElement).blur());
        }
      }}
      className={cn(
        "hover:border-input border-transparent bg-transparent shadow-none dark:bg-transparent",
        "focus-visible:bg-background dark:focus-visible:bg-gray-2",
        className,
      )}
      {...props}
    />
  );
}
