# packages/backend: Convex rules

All of Pantry's business logic lives here (`convex/`). apps/web, the Mac app and packages/mcp only call these
functions. The root AGENTS.md still applies; these rules are on top of it.

## Rules

- Every public Convex function calls requireMember(ctx) or requireToken(ctx, token) first.
  MCP functions resolve everything (spaces, projects, issues, …) inside the token's workspace and return "not found" otherwise.
  The only exceptions are setup.status, setup.createWorkspace, invites.accept and invites.peek; keep them minimal
  and don't add more without a reason written next to the function.
- Every issue write updates updatedAt and inserts one activity row (via "app" or "mcp").
- Status changes (app or MCP) go through the one helper behind issues.move; issues.update never changes status.
- Sub-issues: one level, no loops, always inherit the parent's space and project (one shared helper, app and MCP).
  These shared helpers live in convex/lib/issues.ts and convex/lib/activity.ts; MCP functions reuse them.
- Never store plain tokens; SHA-256 hash only. Generate randomness in actions.
- Schema changes must be backward compatible (add optional fields first, migrate, then tighten): docs/MIGRATIONS.md.
  Self-hosted instances deploy whatever they merge on top of their existing data. The Spaces release ships a
  TRANSITIONAL schema; read rows through convex/lib/model.ts, never raw.
- Env vars are declared in convex/convex.config.ts as optional: a required one the deploy key can't set would fail
  `convex deploy` before the user reaches the setup screen.

## Working here

- convex/_generated is committed, so CI needs no backend. After changing functions or the schema, regenerate it:
  `CONVEX_AGENT_MODE=anonymous npx convex dev --once` (from this folder).
- Tests are `convex/**/*.test.ts`, run with vitest and convex-test in the edge runtime (`pnpm test`). Add a test
  for every guard and every rule above that a change touches; MCP tools get a cross-workspace test each.
- Files under convex/ are deployed to Convex. Keep scripts and Node-only code out of it.
