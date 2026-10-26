#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 1 = build, exit 0 = skip.
# Only production deploys run, so preview builds never touch your Convex data (spec §12 Q4).
echo "Pantry ignore check: VERCEL_ENV=${VERCEL_ENV:-<unset>} branch=${VERCEL_GIT_COMMIT_REF:-<unset>}"
if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "→ production: building."
  exit 1
fi
echo "→ not production: skipping. If this push was to your production branch, check Vercel → Settings → Environments → Production → Branch."
exit 0
