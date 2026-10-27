/** Shown instead of a blank page when the build had no Convex URL (troubleshooting, spec §10). */
export function MissingConvexUrl() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex max-w-md flex-col gap-2 text-sm">
        <h1 className="text-foreground text-lg font-semibold">This app has no Convex address</h1>
        <p className="text-muted-foreground">
          <code className="text-foreground font-mono">NEXT_PUBLIC_CONVEX_URL</code> wasn&apos;t set
          when the app was built. On Vercel, the build command must be{" "}
          <code className="text-foreground font-mono">bash ../../scripts/vercel-build.sh</code> (set
          by apps/web/vercel.json). Locally, run{" "}
          <code className="text-foreground font-mono">pnpm dev</code> from the repo root so Convex
          starts too.
        </p>
      </div>
    </div>
  );
}
