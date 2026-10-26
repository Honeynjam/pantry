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
- Tokens in `packages/ui/src/styles/globals.css` (OKLCH): 12-step neutral scale for light and dark, shadcn semantic variables mapped onto it, monochrome primary (amber in the first draft; changed to monochrome by Kris, Q6 c), success / warning / destructive, six status-category colours, five priority colours, curated label palette, fonts, type scale, density (row heights), radii, motion CSS variables. `@theme inline` maps them to utilities.
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
- Q2 email + password only. Q3 Hobby. Q4 production-only deploys. Q5 Geist / Inter / Geist Mono. Q6 answered by Kris on 26 Oct 2026: (c) none, monochrome. Q7 start fresh. Q8 Claude Code + Cursor with static bearer tokens. Q9 Mac app in v0.1 as M5. Q10 demo on the free plan with hourly reset.
- Defaults list: six fixed statuses, hard delete, hide done/canceled after 14 days, one-level sub-issues, 7-day invites, shadcn style compared in task 4, Tiptap 3 (M2).

## Outcome notes (written after tasks 1–4)

### shadcn style: `base-mira` (★ default kept)
Both styles were generated with the same 14 components and diffed (`shadcn init --base base --preset mira|nova`).

| | base-mira | base-nova |
|---|---|---|
| Button / input height | 28px (`h-7`) | 32–36px (`h-8`/`h-9`) |
| Control text | 12px (`text-xs`) | 14px (`text-sm`) |
| Focus ring | 2px at 30% | 3px at 50% |
| Radius | `rounded-md` | `rounded-lg` / `rounded-4xl` badges |
| Badge | 10px text, pill | 12px text, very round |

Mira is already the dense, compact style the spec asks for (32px rows, 28px controls); nova would need every size
taken down a step. Both were then restyled anyway: text moved up to our 13px UI size, rings replaced by a
keyboard-only outline, popups moved from keyframe animations to interruptible transitions on our motion tokens.

### Other decisions made in task 4
- Popups (menu, popover, tooltip, dialog, sheet) animate with CSS transitions on Base UI's
  `data-starting-style` / `data-ending-style`, timed by the motion CSS variables, so they're interruptible and have a
  `motion-reduce` branch that keeps the fade and drops the scale/slide. Springs (`spring.smooth/snappy/morph`) live in
  `packages/ui/src/lib/motion.ts` and have sampled CSS `linear()` mirrors (`--ease-spring-*`) for CSS-only motion
  (tabs indicator, sidebar width, sheet).
- `PortalContainerProvider` lets a themed subtree portal its popups into itself (used by the light/dark split on
  `/design`; may help Tauri multi-window later).
- The shadcn Sidebar's built-in `Cmd+B` and cookie persistence are removed: `[` goes through the shortcut registry
  (M3) and the app persists the collapsed state per device.
- Greys are pure (`--tint-chroma: 0`). The first draft had a warm tint for amber; after the monochrome change a
  0.003 cool tint was compared side by side and was indistinguishable next to the status colours, so pure grey won.
  `--tint-hue` / `--tint-chroma` stay as the hook for the later neutral-tint setting.
- Dialogs sit in the upper part of the viewport (like a palette) rather than dead centre.
- The default "In Progress" colour changed to `#e5ae00` (from the first draft) so the half-pie stays legible on white.

### Not verified
- Windows/Linux keycap rendering (Ctrl instead of ⌘) was only checked by reading the code.
- No automated visual or a11y tests yet; contrast was checked by eye in screenshots, not with a tool.

## Revision: monochrome (Kris, 26 Oct 2026)
Kris reviewed `/design` and answered Q6 (c): "go monochrome, like MonoCode, with the same vibe as Linear".
- `--primary` = `--gray-12`: near-black + white text in light, near-white + dark text in dark. `--primary-hover`,
  `--primary-text` (links: text colour + underline) and `--primary-subtle` all map to greys. `--ring` = `--gray-10`.
  Selection is a 20% foreground tint. The logo mark uses `--primary`, so it's monochrome too.
- "via MCP" is the neutral outline badge (the muted fill vanished on hovered rows).
- Label palette's `amber` became `yellow` (hue 95) so no swatch reads as the old accent.
- Dark greys 9–11 were raised (0.52/0.57/0.72 → 0.57/0.61/0.77) so small muted text reaches APCA Lc 60 and
  placeholders Lc 30, matching light mode's comfort.
- Colour left on `/design` (checked by a script that walks every element's computed colours): status, priority
  and label glyphs, the sidebar demo's project dots (user-picked label colours) and feedback states (error text,
  destructive button, the labelled Feedback badges). Nothing else.

### Contrast (computed from the tokens: WCAG 2.x ratio / APCA Lc)
| Pair | Light | Dark |
|---|---|---|
| Primary button text on primary | 17.59 / -104.7 | 16.64 / 94.8 |
| Primary button text on hover | 12.33 / -99.9 | 12.77 / 78.9 |
| Body text on page | 17.74 / 103.4 | 16.64 / -95.7 |
| Muted text on page | 6.14 / 79.8 | 9.43 / -61.6 |
| Muted text on sidebar | 5.93 / 77.4 | 9.10 / -61.3 |
| Muted text in menus/dialogs | 6.26 / 81.2 | 8.64 / -60.8 |
| Muted text on hovered row | 5.30 / 69.9 | 8.19 / -60.2 |
| Faint text (placeholders, hints) | 3.30 / 59.7 | 4.38 / -30.4 |
| Focus ring vs page (non-text, ≥3:1) | 3.95 | 5.16 |
| Focus ring vs sidebar (non-text, ≥3:1) | 3.81 | 4.98 |

Primary, body and muted text pass WCAG AA (4.5:1) in both themes. Faint text (`--faint-foreground`, gray-9) is
3.30:1 light / 4.38:1 dark: fine for placeholders and decorative hints, but it is also used for a few small labels
(menu group labels, sidebar group labels, the "then" between keycaps), where strict WCAG AA would want 4.5:1.
Raising light gray-9 to ~L 0.555 would get there but nearly merges faint and muted text; left for Kris to decide.

**Resolved (Kris, 26 Oct):** `--faint-foreground` is now for placeholders, disabled text and decorative icons only.
Informative small labels (menu, command and sidebar group headings, sidebar counts, shortcut hints, the "then"
between keycaps, input-group addon text, every note on `/design`) use `--muted-foreground`, which passes AA in both
themes (5.30–6.26:1 light, 8.19–9.43:1 dark).

## Tasks 5–8 (26 Oct 2026)

### Decisions and gaps found while building
- **`workspace.current` built in M1.** It's listed for M2 in §10b, but the app shell needs the workspace, me and
  projects, so the read-only query was built now, exactly as specified (with tests). No other M2 functions.
- **`setup.status` grew** to `{ needsSetup, needsSecret, signedIn, isMember }`. It stays public and
  unauthenticated (documented exception): the setup screen and `/api/instance` need `needsSecret` before anyone
  can sign in, and the entry gate needs to tell signed-in non-members apart. It returns booleans only.
- **Projects have no colour field** (schema §10b), but §9d wants coloured project dots. The dot is derived from
  the project key (stable, from the label palette). Add an optional `projects.color` later if Kris wants to pick.
- **Sidebar per §9d, minus three things that belong to later tasks:** `[` to fold (needs the M3 shortcut
  registry), search (opens the M3 palette) and "New project" (M2 `projects.create`). "My issues" is M3; for now the
  nav has Home + projects. The width animates with a CSS transition on the `smooth` spring curve rather than a
  motion value; it doesn't re-render the lists either way.
- **Routing:** `packages/app` stays framework-free; `apps/web` passes Next's router and Link through
  `NavigationProvider`. App routes render client-only (`next/dynamic` with `ssr: false`), like the Tauri build.
- **Local dev:** the web app reads the Convex URLs from `packages/backend/.env.local`, so `pnpm dev` needs no
  copying. `NEXT_DIST_DIR` lets a second dev server run from the same folder (Next 16 allows one per build dir).
- **Production-only builds** (Q4 ★) via `ignoreCommand` in `apps/web/vercel.json`.
- **pnpm:** stays on 10 (see `docs/DEPLOY-TEST.md`): Vercel picks pnpm 9/10 from lockfile 9.0; pnpm 11+ needs
  experimental Corepack.
- **Convex `env get` exits 0 for missing variables**, so the build script reads `env list --names-only` and never
  overwrites an existing secret when it can't read the list.
- **better-auth types:** `ConvexBetterAuthProvider`'s `AuthClient` union rejects a concretely typed client under
  TypeScript 6; cast at that one boundary (runtime shape is exactly what it expects).

### M1 acceptance criteria (status at the end of this run)
| Criterion | Status |
|---|---|
| `pnpm i && pnpm dev` runs Convex dev (local anonymous, no login) + web | ✔ backend half run here; the web half was run on another port because 3000 is taken on this machine by another app. First run also needs the two `convex env set` lines in the README (local deployment). |
| `pnpm turbo typecheck lint test` passes; a GitHub Actions workflow runs it on push | ✔ locally and in a fresh clone with CI's exact steps; workflow committed, green-on-GitHub not yet seen (not pushed). |
| Deploy Button on a fresh Vercel account reaches the setup screen | ⧗ prepared, not run (needs Kris's accounts) — `docs/DEPLOY-TEST.md`. |
| First sign-up becomes owner, with the six default statuses and a sample `PAN` project | ✔ locally in a real browser (and in tests). |
| A second sign-up without an invite is rejected by the server | ✔ locally in a real browser (403, no user row created) and in tests. |
| `GET /api/instance` returns `{ name, convexUrl, convexSiteUrl, serverVersion, minAppVersion, needsSecret }` | ✔ tests + live; `needsSecret` flips with the env var. |
| A redeploy keeps `BETTER_AUTH_SECRET` (you stay signed in) | ⧗ the script never overwrites an existing secret (dry-run checked); real redeploy not run. |
| Button click to signed-in workspace under 10 minutes | ⧗ needs Kris's fresh-account run. |
