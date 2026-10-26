import { CircleAlertIcon } from "lucide-react";

/** Form-level error: icon + text + colour, announced to screen readers. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklch,var(--destructive)_35%,transparent)] bg-[color-mix(in_oklch,var(--destructive)_8%,transparent)] px-2.5 py-2 text-sm text-destructive"
    >
      <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/** Better Auth and Convex errors → a sentence a person can act on. */
export function describeError(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") return data.message;
    if ("message" in error && typeof (error as { message?: unknown }).message === "string") {
      const message = (error as { message: string }).message;
      if (message) return message;
    }
  }
  return fallback;
}
