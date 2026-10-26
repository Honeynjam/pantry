#!/usr/bin/env bash
# Runs only when a Vercel project builds from the repo root (the root vercel.json).
# Pantry's web app lives in apps/web, and the Deploy Button can't set Root Directory,
# so fail fast with the fix instead of Vercel's confusing "No Output Directory named public".
cat >&2 <<'MSG'

✖ Pantry must be built from apps/web, but this Vercel project's Root Directory is the repo root.

  Fix (one time):
    1. Vercel → your project → Settings → Build and Deployment
    2. Root Directory → Edit → apps/web → Save
    3. Leave Framework, Build, Output and Install settings on their defaults (no overrides)
    4. Deployments → latest → Redeploy

  apps/web/vercel.json then supplies the Next.js build and the Convex deploy.

MSG
exit 1
