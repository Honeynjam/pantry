#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 1 = build, exit 0 = skip.
# Skips only deployments Vercel explicitly marks as preview/development, so previews never touch your
# production Convex data (spec §12 Q4). If VERCEL_ENV isn't available here, it builds (fail open):
# a preview build would use the Convex integration's preview deploy key, never production's.
echo "Pantry ignore check: VERCEL_ENV=${VERCEL_ENV:-<unset>} branch=${VERCEL_GIT_COMMIT_REF:-<unset>}"
case "${VERCEL_ENV:-}" in
  preview | development)
    echo "→ ${VERCEL_ENV} deployment: skipping (only production builds run)."
    exit 0
    ;;
  *)
    echo "→ building."
    exit 1
    ;;
esac
