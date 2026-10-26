# M3 notes ("Speed", tasks 1–5)

Built 26 Oct 2026 on branch `m3/speed` (local only, not pushed). Source of truth: `docs/PANTRY-SPEC.md` §10b.

| Task | Commit |
|---|---|
| 1. Shortcut registry, `?` help, `[` sidebar fold, sidebar search | `3994922` |
| 2. Command palette + `issues.search` | `3fb5172` |
| 3. Selection and quick edit (J/K, X, S/A/I/L/P/D) | `7a2d3e8` |
| 4. Optimistic updates | `fbe15ab` |
| 5. My issues + URL filters | `b85a407` |
| Fixes from the production walkthrough | `c595f6b` (Esc before the issue loads), `e972e7b` (reduced-motion highlights) |

## What exists now

- **Registry** (`packages/app/src/shortcuts.ts`): every shortcut declared once (tinykeys binding, keycap, label,
  group, where). The `?` help and the palette's keycap hints are generated from it. Scope stack: `global` →
  page (`list` for list/board/My issues, `issue` for issue detail) → `overlay`. A key goes to the top scope only;
  page scopes fall back to `global`; overlays block everything below. Hooks: `useShortcut`, `useShortcutMap`,
  `useShortcutScope` (`use-shortcuts.ts`).
- **Palette** (`palette/`): our ranking (`rank.ts`), the shared `Command` in `packages/ui` now springs its height
  and glides one highlight. Screens add their own actions with `usePaletteActions`.
- **Selection** (`issues/selection.tsx`) and **quick edit** (`issues/quick-edit.tsx`).
- **Optimistic updates** (`issues/optimistic.ts`): pure functions over `OptimisticLocalStore`, wired in
  `issues/actions.ts` and the comment composer.
- **Filters** (`issues/filters.ts`, `issues/filter-bar.tsx`) and **My issues** (`screens/my-issues.tsx`,
  `/my-issues`).
- **Backend:** `issues.search` (the only backend change).
- **packages/ui:** `Checkbox`, `RollingNumber`; `Command` motion; `MarkdownEditorHandle.setMarkdown`.

## Decisions and spec gaps for Kris

Built this way; each is easy to change.

1. **Overlays are also detected from focus.** Besides the explicit `overlay` scope (palette, help, pickers, new
   issue), focus inside any `role=menu/listbox/dialog/alertdialog` counts as an overlay, so every existing Base UI
   menu and dialog blocks page shortcuts without being wired up. A popup that is animating out doesn't count, so
   a key pressed right after closing a picker isn't lost.
2. **`Esc` on an issue** goes back to the list, board or My issues you last had open in this tab (filters
   included), else the project's list. It's not browser history.
3. **`/`** focuses the title filter on list, board and My issues; everywhere else it opens the palette.
4. **J/K on the board** walk column by column, top to bottom (no H/L: not in §4). The board shows the cursor as
   a ring; the list's highlight glides between rows.
5. **Checkboxes:** list rows show one on hover (and on every row once something is selected). Board cards show it
   only once something is selected, so cards don't carry an empty gap. Checkboxes aren't tab stops; `X` is the
   keyboard path.
6. **Pickers act on the selection, else the cursor's issue.** With neither, a toast says to pick one. `I` doesn't
   toggle: if every target is already yours, a toast says so. The label picker toggles (all have it → remove it,
   otherwise add it where missing) and stays open until Esc. The due-date picker also takes a typed `2026-11-30`.
7. **Status moves of several issues** run bottom-up, so they land on top of the new column in their old order.
8. **URL filters:** status and label go by name (`?status=todo,in-review&label=bug`), since names are unique per
   workspace; renaming one makes old links filter to nothing rather than silently ignoring it. Assignee is
   `me`, `none` or a member id (names can repeat); priority is `urgent/high/medium/low/none`; the title text is
   `q`. Within a facet any value matches, across facets all must. Filters carry over between list and board.
   My issues has no assignee facet.
9. **Optimistic scope:** move (status, category, `completedAt`, placement) and update (title, description,
   priority, assignee, labels, due date) apply at once to `listByProject`, `listMine`, `get` and `search`.
   Parent changes wait for the server (they reshape sub-issue lists and run server checks). A refused comment
   leaves the thread and its text goes back into the editor.
10. **Board drop:** M2's "hold the card until the server answers" is gone; the optimistic move covers it.
11. **`issues.search` extras:** a bare number (`42`) also matches that number as a key in every project; results
    are compact (no description). An exact key always leads the palette, with its group.
12. **Palette contents:** empty query shows Projects, Navigation and Actions (no "recent issues": no query for it
    in §10b). Actions include theme switching and Sign out; on an issue or with a selection, the pickers,
    Assign to me, New sub-issue, Copy key and Copy link.
13. **Motion implementation:** the palette's open and height use the CSS `linear()` spring approximations already
    in our tokens; the highlight uses `motion`'s `morph` spring. The sidebar width is still M1's CSS width
    transition on the smooth spring curve (no re-render of the lists), not a `motion` value; it behaves as §9d
    describes.
14. **Errors:** unexpected server errors (`[CONVEX M(...)] … Server Error`) now show the action's own message
    ("Couldn't move the issue.") instead of Convex's internal text. Errors we raise on purpose are unchanged.
15. **Desktop spike** (`apps/desktop`) still only routes the M2 screens; My issues there is M5's router.

## How it was verified

- `pnpm turbo typecheck lint test --force`: 16/16 tasks (ui 22, backend 78, app 52, web 4 tests). New tests:
  the registry (every §4 shortcut registered and in the help exactly once, scope precedence, typing never fires,
  sequences, closing popups), ranking, optimistic updates on a deep-frozen fake store (an in-place write throws),
  URL filters, `issues.search` (key first, number, title, workspace isolation).
- `pnpm --filter @pantry/web build`: passes (also built with the local Convex URLs for the runs below).
- Browser: Python Playwright (Chromium) against `next build && next start` on :3270 and a local anonymous Convex
  backend on :3290/:3291, with two projects, three labels and ~17 issues.
  - **Keyboard only, every §4 shortcut** (no mouse): 33/33 checks: `?`, `[`, `G` then `P`/`B`/`I`, `⌘K` + `PAN-3`
    and title words, Esc (clear, then close), S/P/A/I/L/D on an issue, `Shift+C` + `⌘↵`, a comment with `⌘↵`,
    Esc back, J/K, X, S/P/A/L/D/I on a selection, Esc clears, Enter opens, C + `⌘↵`, `/` + Esc, `/` on home
    opens search, board J/X/S, letters typed in inputs and editors fire nothing, no page errors.
  - **Every palette action runs:** 37/37 (all 28 rows listed on an issue page, the 7 selection actions on a list,
    an issue hit by key, Sign out last).
  - **Optimistic under a slow link:** DevTools throttling doesn't slow WebSockets, so the Convex socket was routed
    through Playwright with every server→client message held 1.5 s (plus CDP throttling for HTTP). Status, priority
    and assignee changes showed in 1–4 ms; comments showed at once as "Sending…".
  - **Forced server errors** (one mutation's args rewritten in transit so the server's validator refuses it):
    a status move, a priority change, a comment and a board drag each rolled back cleanly about 1.5 s later
    (when the refusal arrived), with a toast, no dimmed or stuck card, and the comment text back in the editor.
  - **URL filters survive a reload** on the list and the board, and carry between them.
  - **Motion, frame by frame:** the palette highlight glides one row and snaps on End; the results frame springs
    from 320 to 116 px as results shrink; the list cursor and the sidebar width spring. With
    `prefers-reduced-motion: reduce` all of them jump straight to the end state.
- Screenshots (`docs/screenshots/m3-*-{light,dark}.png`, 2×): `palette`, `help`, `multiselect-picker`,
  `board-selection`, `my-issues`, `filter-bar`, `filter-menu`.

## M3 acceptance criteria

| Criterion | Status |
|---|---|
| Every shortcut in §4 works and shows in the `?` help | ✔ keyboard-only run (33/33) and the registry test |
| The command palette finds issues by key and title | ✔ `PAN-3` and "sticky safari" jump to PAN-3 |
| Status, assignee and priority changes appear before the server confirms them | ✔ 1–4 ms with replies held 1.5 s; forced errors roll back |
| "My issues" lists open issues assigned to me | ✔ `/my-issues` (Todo, In Progress, In Review), across projects |
| URL filters narrow the list and board and survive a reload | ✔ |

## Not verified

- Safari and Firefox (Chromium only); mobile widths; VoiceOver itself (live regions and labels were checked in the
  DOM, not heard).
- DevTools' own network throttling: it doesn't apply to WebSockets, so the slow link was simulated at the socket.
- The forced errors were validator refusals injected in transit, not real server failures or a dropped connection.
- Anything against a deployed instance, and the Tauri app.
- Lists with hundreds of issues (filtering and ranking are client-side over what's loaded).
