#!/usr/bin/env bash
# Seeds a LOCAL deployment for the perf runs (docs/IMPROVEMENTS.md). Needs `convex dev` running for
# packages/backend against a local/anonymous deployment, and the workspace set up in the browser first.
#   bash scripts/perf/seed.sh [scale]     # scale 1 = 2,600 issues over 3 spaces
# The seed functions are copied in, run, and removed again; they're never committed or deployed.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT/packages/backend"
if grep -q "CONVEX_DEPLOYMENT=prod\|CONVEX_DEPLOY_KEY" .env.local 2>/dev/null; then
  echo "✖ Refusing to seed: packages/backend/.env.local doesn't point at a local deployment" >&2
  exit 1
fi
cp "$ROOT/scripts/perf/devSeed.ts" convex/devSeed.ts
trap 'rm -f convex/devSeed.ts' EXIT
# convex dev picks the file up; give it a moment to push.
for _ in $(seq 1 30); do npx convex run devSeed:counts >/dev/null 2>&1 && break; sleep 1; done
npx convex run devSeed:run "{\"scale\": ${1:-1}}"
npx convex run devSeed:counts
