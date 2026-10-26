/** Shown instead of a blank page when the build had no Convex URL (troubleshooting, spec §10). */
export function MissingConvexUrl() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex max-w-md flex-col gap-2 text-sm">
        <h1 className="text-lg font-semibold text-foreground">This app has no Convex address</h1>
        <p className="text-muted-foreground">
          <code className="font-mono text-foreground">NEXT_PUBLIC_CONVEX_URL</code> wasn&apos;t set when the app was
          built. On Vercel, the build command must be <code className="font-mono text-foreground">bash ../../scripts/vercel-build.sh</code>{" "}
          (set by apps/web/vercel.json). Locally, run <code className="font-mono text-foreground">pnpm dev</code> from the
          repo root so Convex starts too.
        </p>
      </div>
    </div>
  );
}
