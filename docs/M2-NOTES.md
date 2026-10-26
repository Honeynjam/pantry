# M2 notes (tasks 1, 3, 4, 5, 6)

Built 26 Oct 2026 on branch `m2/core` (local only, not pushed). Tasks 2 (Tauri spike) and 7 (`sync-upstream`)
belong to another session. Source of truth: `docs/PANTRY-SPEC.md` §10b.

| Task | Commit |
|---|---|
| 1. Invites | `bc6ad5d` |
| 3. Workspace data + `MarkdownEditor` | `884c126` |
| 4. Issues backend (+ comments) | `0851018` |
| 5. List view + issue detail | `1d84ae0` |
| 6. Board view | `e863aa4` |
| Walkthrough, fixes, these notes | last commit on the branch |

## What exists now

- **Backend** (`packages/backend/convex`): `invites.*`, `projects.*`, `labels.*`, `statuses.*`, `docs.*`,
  `issues.create/update/move/remove/get/listByProject/listMine`, `comments.add/edit/remove`. The rules shared with
  M4's MCP functions live in `lib/issues.ts` (numbering, the one sub-issue helper, the one status-change helper,
  ordering, field updates with one activity row each) and `lib/activity.ts`. 77 backend tests.
- **UI** (`packages/app`, `packages/ui`): settings (Members & invites, Projects, Labels, Statuses), project
  settings (name, fixed key, context doc, archive), the list grouped by status, the issue page, the board, the
  new-issue dialog, `MarkdownEditor`, `ColorPicker`. Routes in `apps/web`: `/settings/[section]`,
  `/projects/[key]` (list), `/projects/[key]/board`, `/projects/[key]/settings`, `/issues/[key]`.
- **Markdown round-trip**: 8 fixtures in `packages/ui/test/fixtures/markdown` (agent notes, tables, HTML, images,
  reference links, setext headings, task lists, odd spacing). Tests (vitest + happy-dom, 22) and a browser run
  both show: untouched → saved byte for byte with no activity row; one block edited → every other block and the
  spacing between them byte for byte.

## Decisions and spec gaps for Kris

Things the spec didn't pin down; built this way, easy to change.

1. **Invites.** A new invite for an email revokes that email's pending invite (the link is shown only once, so
   re-inviting is how you "copy it again"). Inviting someone who's already a member is rejected. `accept` is a
   no-op for someone who is already a member, so a double submit can't fail. The sign-in page also takes
   `?invite=`, for a person who already has an account on the instance. The link is built from Convex `SITE_URL`
   (falls back to the browser's origin). `invites.create` returns `{ inviteId, token, url, expiresAt }`.
2. **No invite preview.** Before sign-up the page can't show who invited you or prefill the email, because §10b's
   function list has no public "peek" query. Adding `invites.peek({ token }) → { email, workspaceName }` would be
   a small, safe addition if you want it.
3. **Names are unique, ignoring case**, for labels and statuses: MCP resolves both by name (§10b MCP tools).
4. **Project keys** are unique per workspace *including archived projects* (their issues keep their keys). There's
   no unarchive in the spec, so none in the UI.
5. **Colours** are validated on the server: a palette name (`violet`) or a `#rrggbb` hex. Statuses can be
   recoloured from the label palette plus their category's default. Projects still have no colour field; the dot
   is derived from the key (kept, as the brief suggested).
6. **Activity `from`/`to`** hold readable snapshots: status, label and member names, issue keys, ISO days and
   priority digits, so history reads right after renames and deletes.
7. **Reordering inside a column writes no activity row and doesn't bump `updatedAt`.** The activity types have no
   "reordered", and the issue itself didn't change. The M2 criterion says every change leaves an activity row;
   if you count a reorder as a change, it needs a new activity type (schema change, additive).
8. **Removing a label** is an issue write for every issue that had it: each gets `updatedAt` and one
   `labels_changed` row.
9. **Comments.** `comments.add` bumps the issue's `updatedAt` and adds a `commented` row. Edit and delete write no
   activity (there are no types for them); a deleted comment's `commented` row stays (the timeline hides
   `commented` rows because it shows the comments themselves).
10. **New issues default to the first `unstarted` status** (Todo), same as MCP `create_issue`.
11. **`issues.move` placement:** `afterId` = the issue it lands right after, `beforeId` = right before. Neighbours
    that aren't in the target column are ignored (they may have just moved in another browser). Done → Canceled
    keeps the original `completedAt`.
12. **`issues.get` returns `null`** for an unknown key (the page shows "There's no issue PAN-99") instead of
    throwing.
13. **Limits:** titles 200, comments 20,000 (from the MCP spec), descriptions and context docs 100,000 characters.
14. **Permissions:** only invites are owner-only (as specified). Any member can edit projects, labels and statuses.
    There's no "remove member" (not in the spec).
15. **List view hides empty status groups** (like Linear); the new-issue dialog has a status picker for those. The
    board always shows all six columns.
16. **Board drop is held in place until the mutation resolves**, so the card doesn't flash back to its old slot.
    That's a local hold, not optimistic updates (M3 adds those, in `issues/actions.ts`, for every view at once).
17. **Keyboard dragging on the board** uses dnd-kit's keyboard sensor: Space picks a card up and drops it, arrows
    move it 25px a step (checked in the browser: 6 × Down moves it one slot, 11 × Right one column), and a live
    region announces "Dropped PAN-2 in In Review". It works but is clunky across columns; M3's `S` status picker
    is the real keyboard path. Enter on a focused card opens the issue.
18. **Markdown editor:** tables, HTML blocks, link definitions and images are kept as written (raw nodes; raw
    blocks are editable as plain text and shown dashed). Task lists (`- [ ]`) are supported because agents write
    them. If you edit a block, Tiptap writes that block in its own style (`-` bullets, `*em*`, `[url](url)` for
    autolinks); untouched blocks keep yours.
19. **Concurrent edits:** if two people edit the same description at once, the last save wins (the editor keeps
    your text while you're typing, and takes the server's when you're not).
20. **Local dev:** `convex dev` writes `VITE_CONVEX_URL` (not `CONVEX_URL`) to `packages/backend/.env.local` when it
    finds Vite installed (vitest pulls it in). `next.config.ts` now reads both.

## M2 acceptance criteria

| Criterion | Status |
|---|---|
| An owner creates an invite for an email and the partner joins through the link | ✔ in a real browser (two contexts), and tests for expired, revoked, wrong-email and reused tokens |
| Create, edit and move issues in list and board views, with sub-issues one level deep | ✔ in the browser; the depth limit, loops and project inheritance are tested |
| Every change shows in a second browser within 1 second without a reload | ✔ 16 timed checks, slowest 321 ms (local backend) |
| …and leaves an activity row | ✔ for every issue field, status change and comment; ✘/? reordering within a column (decision 7) |
| Tauri spike: a dev build connects to the deployed instance and signs in | the other session's task (2) |

## How it was verified

- `pnpm turbo typecheck lint test`: passes (backend 77, ui 22, web 4 tests).
- Browser runs with Python Playwright against a local anonymous Convex backend on ports 3260/3261 and
  `next dev` on 3240 (other sessions use 3210/3211 and 3217–3219): owner in a light context, partner in a dark one.
  The full walkthrough ran on a freshly wiped deployment: setup → labels → invite → partner joins → seven issues
  from the list → inline edits → issue page edits, two sub-issues, a comment → board drags across and within
  columns → reload → activity rows. Timings were measured from the action to the change appearing in the other
  browser.
- The "via MCP" tag was checked with a comment and a status change written as `via: "mcp"` straight into the local
  database (MCP itself is M4).
- A board drag with `prefers-reduced-motion: reduce` emulated still moves the card (no settle animation or travel).

Screenshots (`docs/screenshots/`): `m2-walkthrough-01…13` (the flow above), `m2-settings-*`,
`m2-project-settings-*`, `m2-via-mcp-*`, `m2-markdown-agent-notes-*`, `m2-board-reduced-motion-light`. Light
shots are the owner's browser, dark the partner's.

## Not verified

- Anything against a deployed instance (local backend only, by design).
- Safari and Firefox (Chromium only). Mobile widths were not walked through.
- VoiceOver itself (the board's live-region text was checked, not heard).
- Behaviour with hundreds of issues (lists load whole columns; fine for 1–3 people, not measured).
