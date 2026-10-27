"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@pantry/ui/components/dialog";
import { Keycap } from "@pantry/ui/components/keycap";
import { helpSections } from "../shortcuts";
import { useShortcutScope } from "../use-shortcuts";

const SECTIONS = helpSections();

/** The `?` help: generated from the shortcut registry, so it can't drift from the bindings. */
export function ShortcutHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useShortcutScope("overlay", open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl" showCloseButton>
        <div className="border-border flex flex-col gap-1 border-b px-5 pt-4 pb-3.5">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Letter keys never fire while you&apos;re typing. Esc closes this.
          </DialogDescription>
        </div>
        <div className="grid max-h-[min(70vh,36rem)] gap-x-8 gap-y-5 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <section
              key={section.group}
              aria-labelledby={`shortcuts-${section.group.replace(/\s+/g, "-")}`}
              className="flex flex-col gap-1"
            >
              <h3
                id={`shortcuts-${section.group.replace(/\s+/g, "-")}`}
                className="text-muted-foreground pb-1 font-sans text-xs font-medium tracking-normal"
              >
                {section.group}
                {section.where && (
                  <span className="text-faint-foreground font-normal"> · {section.where}</span>
                )}
              </h3>
              <dl className="flex flex-col">
                {section.rows.map((row) => (
                  <div key={row.id} className="flex min-h-7 items-center gap-3 text-sm">
                    <dt className="min-w-0 flex-1">
                      <span className="text-foreground">{row.label}</span>
                      {row.where && (
                        <span className="text-muted-foreground block text-xs">{row.where}</span>
                      )}
                    </dt>
                    <dd className="shrink-0">
                      <Keycap keys={row.keys} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
