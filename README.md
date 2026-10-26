# Pantry

A fast, keyboard-first, open-source (MIT) issue tracker for 1–3 person teams working with AI coding agents.
Your agents read and update issues over MCP; your data lives in your own Vercel and Convex accounts.

> Status: early development (milestone M1). Not ready to deploy yet.

## Repo layout

| Path | What |
|---|---|
| `apps/web` | Next.js App Router web app (Vercel): renders `packages/app`, `/api/auth`, `/api/mcp`, `/api/instance` |
| `packages/backend` | Convex functions, schema and Better Auth (`convex/`). All business logic lives here |
| `packages/app` | Client-only React screens (shared by web and the Mac app) |
| `packages/ui` | Design system: tokens, theme, shadcn/ui components on Base UI, motion tokens |
| `packages/mcp` | MCP tool definitions |
| `packages/tsconfig`, `packages/eslint-config` | Shared config |
| `docs/` | Spec (`PANTRY-SPEC.md`) and milestone notes |

## Develop locally

Requirements: Node 24 (`nvm use`), pnpm 10 (`corepack enable` or `npm i -g pnpm@10`).

```bash
pnpm i
pnpm dev                       # Convex local backend (no login) + web on http://localhost:3000
pnpm turbo typecheck lint test # what CI runs
```

`pnpm dev` starts Convex with `CONVEX_AGENT_MODE=anonymous`, which runs a local Convex backend on your machine with no
Convex account. Set `CONVEX_AGENT_MODE=` (empty) to use your own Convex dev deployment instead.

The local Convex deployment needs two env vars for sign-in (local deployment only):

```bash
cd packages/backend
npx convex env set SITE_URL http://localhost:3000
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
```

### Design system review page

`packages/ui` holds the tokens, theme provider, motion tokens and components. A dev-only page shows all of them in
light and dark:

```bash
pnpm --filter @pantry/web dev   # then open http://localhost:3000/design
```

Use the header controls to switch theme, show light and dark side by side, or preview reduced motion. Production
builds return 404 for `/design` unless `PANTRY_DESIGN_PAGE=1` is set at build time.

### Tests

```bash
pnpm turbo test                 # convex-test + vitest for packages/backend
```

## Licence

MIT, see [LICENSE](LICENSE).
