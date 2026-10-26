/** Blank while auth and status resolve; a quiet hint appears only if it takes longer than 400ms. */
export function LoadingScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background" aria-busy="true">
      <span className="animate-in text-sm text-muted-foreground delay-400 duration-(--duration-standard) fill-mode-both fade-in motion-reduce:animate-none">
        Loading…
      </span>
    </div>
  );
}
