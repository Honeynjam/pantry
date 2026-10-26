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
