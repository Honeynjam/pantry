# M1 plan (tasks 1–4 in this run)

Written 26 Oct 2026 before coding. Source of truth: `docs/PANTRY-SPEC.md` §10b. This run stops after task 4 so Kris can approve `/design`.

## Plan

### 1. Scaffold
- `git init`, spec to `docs/PANTRY-SPEC.md`, kickoff prompt to `docs/KICKOFF-PROMPT.md`, `CLAUDE.md` stays at the root.
- pnpm workspace (`packageManager: pnpm@10.34.9`), Turborepo 2.11, Node 24 (`.nvmrc`, `engines`).
- Packages: `apps/web` (Next.js 16.4), `packages/backend`, `packages/app`, `packages/ui`, `packages/mcp`, plus shared `packages/tsconfig` and `packages/eslint-config`. `apps/desktop` and `apps/site` are not created yet (M5/M6); the workspace globs already cover them.
- Shared strict tsconfig, ESLint 10 flat config (typescript-eslint, react-hooks; Next's config in `apps/web`), Prettier.
- MIT `LICENSE`, `README.md`, `.env.example`, `.gitignore`.
- Turbo tasks: `dev`, `build`, `typecheck`, `lint`, `test`.
- Done: `pnpm turbo typecheck` passes on the empty packages.

### 2. Backend
- `convex.config.ts`: Better Auth component + `defineApp({ env: { SITE_URL, BETTER_AUTH_SECRET } })`, both `v.optional(v.string())`.
- `auth.config.ts` (`getAuthConfigProvider()`), `auth.ts` (`createClient` + `createAuth`: email + password, `convex()` plugin, invite-only `databaseHooks.user.create.before`, clear "Missing BETTER_AUTH_SECRET" error), `http.ts` (`registerRoutes`).
- Full §10b schema, `lib/brand.ts`, `lib/auth.ts` (`getAuthUserId`, `requireMember`).
- The sign-up guard runs in Better Auth's hook, which may execute in an HTTP action (no `ctx.db`), so it calls an internal query `auth.canSignUp({ email })` through `ctx.runQuery`.
- Tests (`vitest` 5 + `convex-test` 0.0.65 + `@edge-runtime/vm`, Better Auth component registered with `@convex-dev/better-auth/test`): first sign-up allowed, second rejected without an invite, allowed with a pending invite, rejected with expired / revoked / accepted invites, email matched case-insensitively; `requireMember` throws for no identity / no member.
- `pnpm dev` in the backend runs `convex dev` with `CONVEX_AGENT_MODE=anonymous` unless set (local backend, no login).
- Done: `CONVEX_AGENT_MODE=anonymous npx convex dev --once` pushes to the local backend; tests pass.

### 3. Bootstrap
- `setup.createWorkspace({ workspaceName?, displayName? })` mutation: requires a signed-in Better Auth user (not a member, see gaps), refuses if any member exists. Creates workspace (slug from name), owner member, the six default statuses, a sample `PAN` project (key from `brand.defaultKey`) with its context doc.
- `setup.status` query (public, no auth: needed by the setup screen in task 5) → `{ needsSetup }`. Read-only and leaks nothing but a boolean.
- Shared default data in `convex/lib/defaults.ts` (statuses with colours, sample context doc).
- Tests: first run creates everything; second run rejected; unauthenticated rejected; the owner then passes `requireMember`.

### 4. Design system
- shadcn CLI 4.22 in monorepo mode with `--base base`: `components.json` in `packages/ui` and `apps/web`, components in `packages/ui/src/components`, imported from `@pantry/ui/components/*`.
- Compare `base-mira` and `base-nova` on the same component set, pick one, record why.
- Tokens in `packages/ui/src/styles/globals.css` (OKLCH): 12-step neutral scale for light and dark, shadcn semantic variables mapped onto it, amber primary, success / warning / destructive, six status-category colours, five priority colours, curated label palette, fonts, type scale, density (row heights), radii, motion CSS variables. `@theme inline` maps them to utilities.
- Fonts: Geist (display) / Inter (UI) / Geist Mono via `@fontsource-variable/*` (self-hosted, no `next/font`, so `packages/app` and Tauri get the same files).
- `ThemeProvider` (system / light / dark, `.dark` on `<html>`, no `next-themes`) + a no-flash inline script.
- Motion tokens in `packages/ui/src/lib/motion.ts` (springs `smooth` / `snappy` / `morph`, tween durations and eases) with `useReducedMotion` helpers.
- Components restyled: button, input, field, dialog, dropdown menu, popover, tooltip, sidebar, command, badge, avatar, tabs, toast (sonner), kbd. Ours: status glyph, priority glyph, label chip, issue key, keycap, avatar stack.
- Dev-only `/design` page in `apps/web` (404 in production builds) showing every token and component in light and dark side by side, plus a toggle.
- Check it in a real browser with screenshots, light and dark, and iterate before calling it done.

## Spec gaps and contradictions found

1. **shadcn style names.** The CLI (4.22.1) takes `--base base --preset mira|nova`; `components.json` then records `"style": "base-mira"`. So "base-mira" in the spec is right, just not a CLI flag.
2. **shadcn monorepo template defaults differ from the spec.** It uses `@workspace/*` package names, Hugeicons, `next-themes` and a `cn` npm package. We use `@pantry/*`, `lucide-react` (spec's base deps), our own theme provider (spec: no `next-themes`) and a local `cn` (clsx + tailwind-merge).
3. **Package scope is a rename touchpoint.** Workspace packages are named `@pantry/*`. The brand rule says only `brand.ts`, the README, the Deploy URL and Tauri config hard-code the name. Package names aren't runtime strings, but a rename would touch them; worth listing in the rename checklist.
4. **TypeScript version is not pinned.** npm `latest` is TypeScript 7.0.2 (the native port), but `typescript-eslint` 8.72 peers on `<6.1.0`. Pinned `typescript ~6.0.3`.
5. **pnpm version.** Vercel's docs list pnpm 6–10 (pnpm 10 is auto-selected for lockfile 9.0); a June 2026 forum report shows pnpm 11 falling back to npm. Pinned `pnpm@10.34.9`. Recheck in task 7.
6. **Node.** The machine's default Node is 22.22.1; Node 24.22.1 was installed via nvm for this repo (`.nvmrc`). `engines.node` is `>=24`.
7. **`setup.createWorkspace` cannot call `requireMember`.** It runs before any member exists. It requires a signed-in Better Auth user instead (`getAuthUserId`). Likewise `setup.status` must be callable signed-out so the setup screen can decide what to show. Both are documented exceptions to "every public function calls requireMember".
8. **Orphan sign-ups during setup.** Sign-up is open while there are no members. If two people sign up before either finishes setup, only the first `createWorkspace` wins; the other account exists with no member row. Acceptable for v0.1 (setup is seconds, one person); the setup screen in task 5 should create the workspace right after sign-up.
9. **Unspecified setup details.** Workspace name default, slug rule, sample project name, default status colours and the sample context doc content aren't in the spec. Defaults chosen: workspace name from the form, else "{displayName}'s workspace"; slug = lower-kebab name; sample project name = `brand.name` with key `brand.defaultKey` (`PAN`); status colours are fixed hex values that match the design tokens; context doc is a short template that explains what agents should read.
10. **Status colours are stored strings, design tokens are CSS.** Statuses are user-recolourable later, so the six defaults are stored as hex. Status glyphs take a colour prop, falling back to the category token when absent.
11. **`/design` "dev-only".** It renders in `next dev` and returns 404 in production builds unless `PANTRY_DESIGN_PAGE=1` is set, so Kris can still preview it on a deployment if he wants.
12. **Fonts.** `next/font` would tie the fonts to Next; `packages/ui` serves them from `@fontsource-variable/*` so web, desktop and site share the same files.
13. **`pnpm dev` + anonymous Convex.** The backend dev script defaults `CONVEX_AGENT_MODE=anonymous` only when it isn't set, so people who have logged in to Convex can still use their own dev deployment by setting it to empty.
14. **`convex/_generated` is committed** so `pnpm turbo typecheck` works in CI and on a fresh clone without a backend.

## ★ defaults used (§12)
- Q2 email + password only. Q3 Hobby. Q4 production-only deploys. Q5 Geist / Inter / Geist Mono. Q6 amber accent. Q7 start fresh. Q8 Claude Code + Cursor with static bearer tokens. Q9 Mac app in v0.1 as M5. Q10 demo on the free plan with hourly reset.
- Defaults list: six fixed statuses, hard delete, hide done/canceled after 14 days, one-level sub-issues, 7-day invites, shadcn style compared in task 4, Tiptap 3 (M2).
