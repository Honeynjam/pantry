# Architecture and speed pass

Branch `improve/arch-speed`, based on `main` at `22a2190` (M1–M4 + Spaces). Local only, not pushed. Everything
here was measured, not guessed; the tools are in `scripts/perf/` (see "How to re-measure" at the end).

## Setup for the numbers

- **Data:** a local anonymous Convex backend (`:3370/:3371`), the owner set up through the UI, then
  `scripts/perf/devSeed.ts`: 3 spaces (PAN 1,500 issues, WEB 800, OPS 300 = 2,600), 6 projects, 5 labels,
  ~12% sub-issues, descriptions of 0–1.5 kB of markdown, ~3,400 comments and ~7,750 activity rows. About two
  thirds of the issues are done or canceled, most of them more than 14 days ago, like a tracker that has been
  used for a while. PAN's list shows 600 issues (the open ones plus recently done).
- **Backend:** `scripts/perf/measure-backend.mjs` calls each function with `convex run` and reads Convex's own
  usage stats from `convex logs --jsonl` (documents read, bytes read, execution time) plus the size of the
  result. Cold cache (backend restarted first).
- **Bundle:** `scripts/perf/bundle-report.mjs` reads a `next build` (Turbopack doesn't print first-load JS):
  root main files + the route's layout and page chunks. `chunk-contents.mjs` attributes a chunk's bytes to
  packages through a source-map build.
- **Browser:** `scripts/perf/browser-perf.py` (Python Playwright, Chromium, **4× CPU throttling**) against
  `next build --profile --no-mangling && next start` (React's profiling build, readable names). Render counts
  come from a stub React DevTools hook that counts every component that actually ran in a commit. Key latency
  is the Event Timing API's duration for the keydown (input delay + handlers + render, up to the next paint).
  WebSocket bytes come from CDP.

## Baseline

### First-load JS per route (production build)

| Route | Raw | Gzip |
|---|---|---|
| every app route (`/`, `/sign-in`, `/sign-up`, `/setup`, `/spaces/[key]`, `/spaces/[key]/board`, `/issues/[key]`, `/my-issues`, `/settings/*`) | 1,784 kB | 550 kB |

Every route loads the same 11 chunks, because `apps/web/app/(app)/client-app.tsx` imports
`NavigationProvider`/`PantryProviders` from the `@pantry/app` barrel and the (app) layout then pulls in
every screen. The biggest chunk (789 kB raw / 239 kB gzip) is:

| Package | kB (raw) |
|---|---|
| prosemirror-view / -model / -transform / -state / -commands | 190 |
| @tiptap/core, markdown, extension-list, react, link, extensions | 152 |
| convex | 82 |
| packages/app screens + issues | 124 |
| marked (Tiptap markdown) | 39 |
| @dnd-kit/core (board only) | 38 |
| linkifyjs (Tiptap link) | 17 |
| better-auth + better-fetch | 24 |

So the sign-in page ships the markdown editor and the board's drag and drop.

### Backend (2,600 issues, cold cache)

| Call | Docs read | kB read | kB returned | ms |
|---|---|---|---|---|
| `workspace.current` | 29 | 6.9 | 4.3 | 3 |
| `issues.listBySpace` PAN (600 shown) | **1,509** | **1,990** | **767** | 84 |
| `issues.listBySpace` PAN `includeDone` | 1,509 | 1,990 | 1,931 | 84 |
| `issues.listBySpace` WEB | 808 | 1,038 | 368 | 42 |
| `issues.listMine` (sidebar, every page) | 470 | 608 | **602** | 23 |
| `issues.get` PAN-1200 | 12 | 5.5 | 4.7 | 7 |
| `issues.search` "board" | 21 | 22.5 | 5.5 | 7 |
| `issues.search` "42" | 7 | 4.4 | 0.8 | 6 |
| `mcp.listIssues` (no filter, 50) | 108 | 85 | 13 | 38 |
| `mcp.listIssues` space=OPS status="In Review" | **2,648** | **3,337** | 10.5 | **443** |
| `mcp.getIssue` PAN-1200 | 23 | 7.9 | 2.6 | 3 |
| `issues.move` → Done (top) | **839** | **1,133** | – | 40 |
| `issues.move` → Todo | 124 | 160 | – | 6 |
| `issues.update` priority | 3 | 3.1 | – | 2 |
| `issues.create` (Todo) | 129 | 160 | – | 6 |
| `mcp.updateIssue` status → In Progress | 199 | 236 | – | 8 |

Convex's per-function limits are 16 MiB read and 32,000 documents scanned. At this data shape
`listBySpace` reads ~1.3 kB per issue in the space, done or not, so a space with ~12,000 issues would stop
loading altogether; `mcp.listIssues` with a selective filter hits it at ~12,000 issues in the workspace; a move to
Done at a few thousand done issues in one space costs megabytes per drag.

### Browser (4× CPU, PAN list with 600 rows)

| Measure | Baseline |
|---|---|
| List load: components rendered / long tasks | 32,086 / 1,807 ms |
| List load: WebSocket data | 1,380 kB |
| **J / K on the list: keydown → paint** | **744 ms / 696 ms median** (31,172 components per press; every one of the 600 rows) |
| X on the list | 816 ms median |
| Someone else changes one issue's priority (server push) | **1,374 kB** over the socket, 600 rows re-render (31,431 components) |
| P quick edit → pick a priority (optimistic + server) | 2,400 row renders, 125,108 components, 770 kB over the socket |
| ⌘K palette open | 160 ms keydown, visible after 232 ms |
| Board load: components / long tasks | 9,571 / 596 ms |
| J on the board | 168 ms median (8,638 components per press) |
| Issue page load: WebSocket data | 615 kB (almost all of it `listMine` for the sidebar badge) |
| My issues load (469 rows): components / long tasks | 25,776 / 1,296 ms |

### Dev loop

| | Baseline |
|---|---|
| `pnpm turbo typecheck lint test --force` | 11.7 s wall (17 tasks, 44 s CPU) |
| Critical path | `ui#typecheck → backend#typecheck → app#typecheck → web#typecheck`, because `typecheck` and `lint` depend on `^typecheck`/`^lint` although nothing consumes their output (TypeScript reads sources) |
| Tests | backend 133 in 0.75 s; all fast |

## Findings, ranked (impact × effort)

| # | Finding | Evidence | Impact | Effort |
|---|---|---|---|---|
| 1 | **Every list row re-renders on every J/K/X and on every server update.** `IssueRow` isn't memoised, reads the selection from a context whose value is a new object on every cursor move, and Convex hands over brand-new objects for the whole result on every change. Each row is ~52 components (4 Base UI menu roots, tooltip, chips) | `issues/issue-row.tsx:40`, `issues/selection.tsx:225`, `screens/space.tsx:308`; 744 ms per J at 4× CPU | Very high | Medium |
| 2 | **`issues.listBySpace` reads every issue the space ever had and ships every description.** It collects each status column whole, then drops old done issues in code. Any write to any issue in the space re-sends the full result | `convex/issues.ts:36-49`; 1,509 docs / 2 MB read / 767 kB out; 1.37 MB pushed for one priority change | Very high | Low |
| 3 | **One client bundle for every route.** The barrel import in `client-app.tsx` puts all screens, Tiptap/ProseMirror/marked (~400 kB raw) and dnd-kit into the layout chunk | 1,784 kB raw / 550 kB gzip on `/sign-in` | High | Low–medium |
| 4 | **`placeInColumn` collects the whole target column** for every create and move (and the MCP status change), to find one or two neighbours. Also widens every write's read set, so concurrent writes to a column conflict | `convex/lib/issues.ts:139-183`; move → Done reads 839 docs / 1.1 MB | High | Low |
| 5 | **`issues.listMine` on every page (sidebar badge) returns full issues with descriptions** | `shell/app-shell.tsx:200`; 602 kB per page load and per change to one of my issues | High | Low (same fix as #2) |
| 6 | **MCP `list_issues` walks the whole workspace** newest-first and filters in code | `convex/mcp.ts:226-240`; 2,648 docs / 3.3 MB / 443 ms for `space=OPS status="In Review"` | Medium (agents call it a lot) | Low |
| 7 | **Board cards re-render on every J/K** (selection context, no memo) | `screens/board.tsx:485`; 168 ms per J | Medium | Low (with #1) |
| 8 | **Turbo serialises typecheck and lint** through `^typecheck` / `^lint` | `turbo.json`; 11.7 s wall | Medium (dev loop, CI) | Trivial |
| 9 | **Client and server copies of the same pure rules**: done/canceled categories, open categories, title normalisation | `issues/optimistic.ts:21-22,152`, `convex/lib/issues.ts:18`, `convex/lib/issues.ts:69` | Low (drift risk) | Low |
| 10 | `issues.search` with a bare number looks the key up space by space, one after another | `convex/issues.ts:149-155` | Low | Trivial |
| 11 | List rows mount 3–4 menu roots each even when closed (~52 components a row), so a 600-row list renders ~32k components on load | `issues/issue-row.tsx`, `issues/pickers.tsx` | Medium (load only, once #1 is fixed) | Medium, some risk |

Smaller things noticed, no action needed: no `as any`, one `as unknown as` (`convex-auth.tsx:113`, a typed
narrowing of the auth client for the cross-domain plugin, fine); `workspace.current` is cheap (29 docs) and
isn't invalidated by issue writes; `issues.get` and `mcp.getIssue` are already index-bounded; backend tests are
fast.

## What changed

One concern per commit; each message has its own measured effect.

| # | Commit | Finding |
|---|---|---|
| – | `9574062` Regenerate `convex/_generated` (the committed `api.d.ts` was missing `lib/avatar`) | housekeeping |
| – | `b68cdde` Baseline, findings and `scripts/perf` | – |
| 1 | `9bf5b12` `placeInColumn` reads the neighbours through the index, not the whole column | #4 |
| 2 | `5f7d116` `listBySpace` reads done/canceled columns from the 14-day cutoff on (new index `by_space_status_and_completed`); list rows (`listBySpace`, `listMine`, `get`'s sub-issues) without `description` | #2, #5 |
| 3 | `390cef3` MCP `list_issues` walks `by_space_and_updated` / `by_assignee_and_updated` when it can | #6 |
| 4 | `d51efee` `issues.search`: per-space key lookups in parallel | #10 |
| 5 | `d7fe244` Rows and cards memoised; selection as flags + stable callbacks; `useStable` keeps unchanged query rows identical; stable mutation functions; checkbox visibility in CSS; dnd-kit sensor options hoisted | #1, #7 |
| 6 | `f5f5648` Pages import `@pantry/app/screens/<name>`; `@pantry/app` and `@pantry/ui` are `sideEffects: false` | #3 |
| 7 | `582a302` + `bc55781` The markdown editor (Tiptap) loads on first use, preloaded when idle; no Suspense (see "A regression caught on the way") | #3 |
| 8 | `343e250` Turbo transit node: typecheck, lint and test run in parallel, cache still keyed on dependencies | #8 |
| 9 | `5a0543e` `convex/lib/rules.ts` (`@pantry/backend/rules`): one copy of `isTerminal`, open categories and title normalisation | #9 |
| 10 | `a2d7bac` `useLookups` builds from the parts it uses, so a new issue elsewhere doesn't re-render every row | fan-out found while measuring |
| 11 | `9fea658` List rows share one menu per picker (Base UI detached triggers) | #11 |
| – | `3f578ad` `scripts/perf/page-ready.py` | – |

Schema: three additive indexes (`issues.by_space_status_and_completed`, `by_space_and_updated`,
`by_assignee_and_updated`). No field changes and no migration; the transitional schema is untouched. The spec's
schema and function tables (§10b) list them.

## Results (same seeded data, same machine)

### Backend (cold cache)

| Call | Before: docs / kB read / kB out | After: docs / kB read / kB out |
|---|---|---|
| `issues.listBySpace` PAN (600 shown) | 1,510 / 1,990 / 768 | **609 / 796 / 342** |
| `issues.listBySpace` PAN `includeDone` | 1,510 / 1,990 / 1,931 | 1,510 / 1,990 / **878** |
| `issues.listBySpace` WEB | 808 / 1,038 / 368 | **304 / 383 / 169** |
| `issues.listMine` | 470 / 608 / 602 | 470 / 608 / **272** |
| `mcp.listIssues` space=OPS status="In Review" | 2,649 / 3,337 / 10.5 (261–443 ms) | **347 / 390** / 10.5 (15–19 ms) |
| `issues.move` → Done | 839 / 1,133 | **7 / 6.7** |
| `issues.move` → Todo | 125 / 160 | **7 / 4.4** |
| `issues.create` (Todo) | 130 / 160 | **11 / 4.1** |
| `mcp.updateIssue` status | 199 / 236 | **30 / 13.7** |
| `workspace.current`, `issues.get`, `issues.search`, `mcp.getIssue` | unchanged (already index-bounded) | |

What it means at scale: `listBySpace` now reads only open and recently closed issues, so years of done issues
cost nothing; `move`/`create` read a handful of documents however big a column gets; `list_issues` is bounded
by one space (or one person).

### First-load JS (production build; raw / gzip)

| Route | Before | After |
|---|---|---|
| `/sign-in`, `/sign-up`, `/setup` | 1,784 / 550 kB | **775–778 / 238–239 kB** |
| `/` (home), `/spaces/[key]`, `/issues/[key]`, `/my-issues`, `/settings/[section]` | 1,784 / 550 kB | **1,170–1,211 / 366–379 kB** |
| `/spaces/[key]/board` (only route with dnd-kit) | 1,784 / 550 kB | **1,261 / 396 kB** |
| Markdown editor chunk (loaded on first use or when idle) | in every route | 454 / 141 kB |

### Browser (profiling build, seeded PAN list of 600 rows)

Interactions, keydown → next paint (Event Timing), median:

| | Before 4× CPU | After 4× CPU | Before 1× | After 1× |
|---|---|---|---|---|
| J on the list | 688 ms (31,219 components, 601 rows) | **128 ms** (121 components, 2 rows) | 176 ms | **28 ms** |
| K on the list | 704 ms | **112 ms** | 168 ms | **24 ms** |
| X on the list | 744 ms | **176 ms** (1 row) | 208 ms | **40 ms** |
| J on the board | 144 ms (8,647 components) | **32 ms** (89) | 40 ms | **16 ms** |
| P quick edit, pick a priority | 704 ms, 1,803 row renders, 94k components | **152 ms**, 2 rows, 614 components | 200 ms | **32 ms** |
| ⌘K palette open | 152 ms | 144 ms | 40 ms | 48 ms |

Live updates (someone else's write while the PAN list is open):

| | Before | After |
|---|---|---|
| One issue's priority changes: socket data / rows re-rendered | 1,375 kB / 601 rows (31,478 components) | **619 kB / 1 row** (356 components) |
| An issue is created in another space | 4.6 kB / **601 rows** | 4.6 kB / **0 rows** |

Loads:

| | Before | After |
|---|---|---|
| List first render: components / long tasks at 4× | 32,133 / 1,852 ms | **20,134 / 1,548 ms** |
| My issues (469 rows): components / long tasks at 4× | 25,776 / 934 ms | **16,452 / 900 ms** |
| Board: long tasks at 4× | 767 ms | **435 ms** |
| Socket data on list load / issue load | 1,380 / 615 kB | **624 / 285 kB** |
| Esc from an issue back to the list, 1× (client navigation, list remounts) | 239 ms | **177 ms** |

Time to content on a fresh page load (`page-ready.py`, median of 5; 3 for cold):

| Screen | Warm cache 1× before → after | Warm 4× | **Cold cache, 40 ms / 1.5 MB/s, 1×** |
|---|---|---|---|
| List | 429 → 398 ms | 1,487 → 1,470 ms | **1,940 → 1,377 ms** |
| Board | 192 → 189 ms | 698 → 703 ms | **1,942 → 1,177 ms** |
| Issue | 95 → 94 ms | 296 → 275 ms | **1,435 → 924 ms** |
| My issues | 323 → 309 ms | 1,216 → 1,035 ms | **1,442 → 1,089 ms** |
| Sign-in | 40 → 38 ms | 90 → 81 ms | **722 → 465 ms** |

With a warm cache on localhost these are flat (within noise): what's left there is auth, the socket, and
building 600 rows of DOM. The bundle work shows on a first visit, which is every visit after a deploy.

### Dev loop

`pnpm turbo typecheck lint test --force`: **11.7 s → 5.4 s** wall (17 tasks). Tests: backend 133 → 138, app
57 → 64 (new: neighbour placement against the old whole-column rule for every anchor pair, list rows without
descriptions, the recent-done index path with and without `completedAt`, MCP space + assignee filters,
`reuseEqual`, description edits only on the issue page's cached copy).

## A regression caught on the way

The first version of the lazy editor used `React.lazy` + Suspense. Render counts and bundle sizes looked
great, but time to content on the issue page went from 100 ms to ~820 ms: React throttles revealing suspended
content (~300 ms), on top of the usual waits. `bc55781` replaced it with a small module-level loader that the
issue page waits on like it waits on its query; it's back to 94 ms (main: 95 ms). `page-ready.py` exists
because of this.

## Not done, and why

- **Virtualising the list.** The remaining list cost is 600 rows of real DOM (~33 components a row now). Windowing
  would break find-in-page, `scrollIntoView` for J/K, sticky group headers and the cursor's layout animation;
  high risk to approved behaviour for ~300 ms at 1× on very large lists.
- **Splitting `listBySpace` per status column** so a change re-sends one column instead of the list (619 kB per
  change on PAN now). Real bandwidth win for big spaces, but six subscriptions and optimistic updates over six
  results; worth it only if spaces this big are common.
- **Denormalised counters** (My issues badge without reading my open issues). `listMine` is shared with the
  My issues page and its optimistic updates keep the badge instant; a separate counter would lag.
- **Trimming more fields from list rows** (`workspaceId`, `creatorId`, `_creationTime`): ~20% more off the payload,
  but rows are `Doc` shapes throughout the app; not worth the type churn now.
- **Splitting big files** (`board.tsx` 640 lines, `issue.tsx` 600, `sidebar.tsx` 720): churn without a
  measurable gain; nothing in them is duplicated.
- **Motion's bundle (~135 kB raw)**: it's on every app screen for the layout animations (cursor, sidebar
  highlight); `LazyMotion` with `domMax` would move most of it to an async chunk but every app page needs it
  right away anyway.
- `packages/ui/src/components/scroll-area.tsx` is unused (stock shadcn). Left in the design system.
- **Narrowing the transitional schema**: out of scope (docs/MIGRATIONS.md, needs every instance migrated).

## Found, not changed (behaviour)

- **Enter on a focused row picker opens the issue instead of the menu.** Focusing a picker in a list row moves
  the cursor to that row, and the list's `open` shortcut then takes Enter (Space and ArrowDown open the menu).
  Same on `main`. The shortcut's own comment says Enter on a menu trigger should be that control's, so it's
  likely a bug: `issues/selection.tsx`, the `open` handler only lets Enter through when the target's row isn't
  the cursor. A one-line fix (only open when the target is the row's `[data-issue-focus]` link or the body), but
  it changes behaviour, so it's yours to decide.

## How it was verified

- `pnpm turbo typecheck lint test` (17/17) and `pnpm --filter @pantry/web build` pass.
- Browser regression on a production build (`next build && next start` on :3340, fresh local backend on
  :3370/:3371, Python Playwright/Chromium), no console errors except the one deliberately forced below:
  - setup → invite link → partner signs up with the pre-filled email and joins (2 members);
  - 6 issues through C + ⌘↵ (one with a markdown description); list J/K, X on two rows, S on the selection,
    P, I, D with a typed date, A; row pickers by mouse (priority, status, assignee, due date quick pick, typed date,
    clear) and keyboard (Space/ArrowDown, arrows + Enter, Esc returns focus to the row's trigger); issue panel and
    new-issue dialog pickers;
  - URL filter `?status=in-progress` narrows the list, survives a reload and carries to the board; board drag
    Todo → Done; board J;
  - issue page description, a comment with ⌘↵; ⌘K by key (`PAN-3`) and by title words; My issues;
  - optimistic move with server replies held 1.5 s: shows in 32 ms; with the mutation's args rewritten in transit
    so the validator refuses it, it rolls back to the old status with "Couldn't move the issue." and nothing stuck;
  - MCP client SDK with a token created in Settings → API tokens: 7 tools listed; `get_issue`,
    `get_space_context`, `update_issue` (status), `add_comment`, `create_sub_issue` (PAN-7 under PAN-1),
    `list_issues` by space + status and by assignee, a bad status name returning the valid names; the issue page
    shows the comment and changes "via MCP"; after revoking the token in the UI, `/api/mcp` answers 401.
- Not verified: Safari/Firefox, mobile widths, screen readers by ear, the Tauri app (`apps/desktop` imports from
  the `@pantry/app` barrel, which still exports every screen; it typechecks), anything on a deployed instance.

## How to re-measure

```bash
# local backend on 3370/3371, owner set up in the browser at http://localhost:3340, then:
bash scripts/perf/seed.sh                         # 2,600 issues over 3 spaces (copied in, run, removed)
node scripts/perf/measure-backend.mjs             # docs / bytes per call (restart convex dev first: cold cache)
NEXT_DIST_DIR=.next-size npx next build           # in apps/web, then:
node scripts/perf/bundle-report.mjs apps/web/.next-size
# profiling build for render counts: NEXT_PUBLIC_CONVEX_URL=… npx next build --profile --no-mangling
python3 scripts/perf/browser-perf.py http://localhost:3340 owner.json --cpu 4 --json out.json
python3 scripts/perf/page-ready.py http://localhost:3340 owner.json --cpu 1,4 [--cold]
```
