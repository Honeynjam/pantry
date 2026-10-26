# Pantry

Open-source (MIT) Linear-style issue tracker for either individuals or small teams working with AI coding agents.
Full spec: docs/PANTRY-SPEC.md. Its §10b "Build plan" (versions, schema, functions, MCP tools, tasks,
acceptance criteria) wins over the summaries elsewhere. Build only what the current task lists.
Open questions (spec §12): if Kris hasn't answered one, use its ★ default and keep going.

## Working rules

- Never deploy or publish: no `vercel`, `npx convex deploy`, `npx convex env set` on a cloud deployment,
  `git push`, `npm publish`, app signing or GitHub releases. Kris runs anything that needs real accounts.

## Stack

pnpm + Turborepo, Node 24. Next.js 16 App Router (apps/web), Convex (packages/backend/convex),
Better Auth via @convex-dev/better-auth 0.12.6 (better-auth pinned ~1.6.33, never 1.7), Tailwind v4,
shadcn/ui on Base UI with our design system (packages/ui), MCP via mcp-handler 2.x (packages/mcp, served at apps/web /api/mcp),
Tauri v2 Mac app (apps/desktop, M5), one-page landing site (apps/site, M6).

## Rules

- All business logic lives in Convex functions. apps/* and packages/mcp are thin adapters.
- packages/app is client-only: no next/* imports, no server components (it must build statically for Tauri).
- Every public Convex function calls requireMember(ctx) or requireToken(ctx, token) first.
  MCP functions resolve everything (spaces, projects, issues, …) inside the token's workspace and return "not found" otherwise.
- Every issue write updates updatedAt and inserts one activity row (via "app" or "mcp").
- Status changes (app or MCP) go through the one helper behind issues.move; issues.update never changes status.
- Model: Workspace → Space → Project → Issue. A space (product or client) owns the issue key, counter, context doc
  and views; a project is an optional workstream inside one space. An issue's project must be in its space.
- Sub-issues: one level, no loops, always inherit the parent's space and project (one shared helper, app and MCP).
- Never store plain tokens; SHA-256 hash only. Generate randomness in actions.
- Product name, default issue key and token prefix come only from packages/backend/convex/lib/brand.ts
  ({ name: "Pantry", defaultKey: "PAN", tokenPrefix: "pan_" }).
- Use packages/ui components (shadcn on Base UI, restyled to our tokens) before writing new UI; no stock-looking shadcn.
- Animate only with the motion tokens in packages/ui, and give every animation a reduced-motion branch.
- Schema changes must be backward compatible (add optional fields first, migrate, then tighten).
- Optimistic updates always build new objects; never mutate what localStore.getQuery returns.
- Keyboard shortcuts are registered only through the shortcut registry in packages/app (it also drives the ? help).
- Do not build: GitHub PR integration of any kind, agents as members/assignees or agents running inside the app,
  a public REST API, webhooks, saved views UI, cycles, AI helpers, Client/Product modes, appearance themes,
  local mode, a hosted plan, Cloudflare deploy, or anything on the spec's "Never" list.

## Commands

pnpm i · pnpm dev · pnpm turbo typecheck lint test
Convex without a login (agent feedback loop): cd packages/backend && CONVEX_AGENT_MODE=anonymous npx convex dev --once

## Done means

Typecheck, lint and tests pass; the task's "Done" line and the milestone's acceptance criteria are met;
README updated if setup changed.
