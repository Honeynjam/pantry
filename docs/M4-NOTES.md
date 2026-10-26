# M4 notes ("MCP", tasks 1–4; task 5 is Kris's)

Built 26 Oct 2026 on branch `m4/mcp`, based on `main` at `9b690d1` (M1–M3 plus Spaces). Local only, not pushed.
Source of truth: `docs/PANTRY-SPEC.md` §6 and §10b.

| Task | Commit |
|---|---|
| 1. Tokens: `tokens.create/revoke/list`, `requireToken`, the API tokens screen | `5f23279` |
| 2. `convex/mcp.ts`: `verifyToken` + one function per tool | `3a3c69f` |
| 3. `packages/mcp` + `/api/mcp` | `0899a90` |
| 4. "via MCP" and the `lastUsedAt` throttle | `e0e6edf` |
| Snippet wrapping fix and screenshots | `2e2521a` |
| 5. Real-client run on your instance | pending with Kris: `docs/spikes/mcp-clients.md` |

## What exists now

- **Tokens** (`convex/tokens.ts`). `create` is an action: a random `pan_` token, with its SHA-256 hash and the
  first 8 characters stored by an internal mutation, and the plain token returned once. `revoke` and `list` cover
  the caller's own tokens. `requireToken` / `findToken` live in `convex/lib/auth.ts`: they hash the token, then
  reject unknown, revoked or malformed tokens, and tokens whose member is gone.
- **Settings → Account → API tokens** (`packages/app/src/screens/settings/tokens.tsx`): create, then the token
  shown once with a copy button, tabs with the Claude Code and Cursor snippets (built in `mcp-snippets.ts` from
  `brand`), the list with "Used …"/"Never used", revoke behind a confirm dialog, and recent revoked tokens. Also
  in the user menu and the palette.
- **`convex/mcp.ts`**: `verifyToken`, `touchToken`, and `getIssue`, `getSpaceContext`, `listIssues`,
  `createIssue`, `createSubIssue`, `addComment`, `updateIssue`. Each calls `requireToken` first and resolves
  everything inside the token's workspace. By-name lookups: spaces and projects in `lib/spaces.ts` (already there),
  statuses, labels and members in the new `lib/names.ts`. Writes go through the app's helpers with
  `via: "mcp"`: `createIssue` (sub-issues inherit space and project), `changeStatus`, `updateIssue`, and
  `lib/comments.ts`'s `addComment`, which `comments.add` now uses too.
- **`packages/mcp`**: `registerTools` (seven tools with `z.object` inputs, read/write annotations, server
  instructions), `createVerifyToken` (asks `mcp.verifyToken`, then calls `mcp.touchToken` only when `lastUsedAt`
  is at least 10 minutes old; the mutation checks again) and `convexBackend` (a ConvexHttpClient). A ConvexError
  from Convex becomes `isError: true` with its message. Any other error becomes a generic `isError` message,
  logged on the server.
- **`apps/web/app/api/mcp/route.ts`**: `withMcpAuth(createMcpHandler(registerTools), verifyToken, { required: true })`
  for GET, POST and DELETE. It answers 503 when the build has no Convex URL. Links in results use the request's
  public origin.
- Comments carry `id="comment-<id>"`, so the link `add_comment` returns scrolls to the comment.
- Spec §6/§10b tool tables now list exactly what the tools return; README has "Connect your agents (MCP)".

## Decisions for Kris

Each one is built this way and easy to change.

1. **Where tokens live:** there's no separate "User settings" page, so Settings gets an **Account** group under
   Workspace with **API tokens**. It's also in the user menu and the palette.
2. **Tokens are personal, even to the owner.** The owner can't see or revoke the partner's tokens. If a partner's
   token leaks, only the partner can revoke it. An owner "revoke all tokens for this member" could come later.
3. **25 live tokens per person** (`MAX_ACTIVE_TOKENS`), to cap runaway scripts.
4. **Priority over MCP** is a name (`none`, `urgent`, `high`, `medium`, `low`) or 0–4, and results show the name.
   The spec didn't say.
5. **Results are JSON text** (names, not ids; ISO times; a `url` per issue). There's no `outputSchema` or
   `structuredContent`. Convex returns objects with sorted keys, so `get_issue`'s fields come back
   alphabetically.
6. **`get_space_context`** returns the space, its active project names and the doc, as specified. It doesn't list
   statuses, labels or members; the error messages list those when needed. Easy to add if agents ask a lot.
7. **401 wording:** for a revoked token, mcp-handler's 401 says "No authorization provided". If Convex is
   unreachable, `withMcpAuth` answers 401 "Invalid token" rather than 503, because it catches `verifyToken`
   errors. Wrapping the route to tell those apart is a small change if you want it.
8. **`list_issues`** walks the workspace's issues newest first (`by_workspace_and_updated`), filters them in the
   function and stops at `limit`. That's fine at v0.1 sizes. A very selective filter over thousands of issues
   would scan more; add an index then.
9. **Snippet URL** is the page's own origin (`window.location.origin` + `/api/mcp`). That's right on the web. The
   Mac app (M5) will need to pass the server URL instead.
10. **Cursor snippet** reads `PANTRY_TOKEN` from the environment, per the spec. The guide explains that Dock-launched
    macOS apps don't see `~/.zshrc`. If that turns out to be too fiddly, the alternative is pasting the token
    into `mcp.json` directly.

## How it was verified

- `pnpm turbo typecheck lint test`: 17/17 tasks. Tests per package: ui 22, backend 130 (new: 10 tokens
  + 3 `lastUsedAt`, 22 MCP), app 57 (new: 3 snippet tests), mcp 17 (new: 12 handler + 5 `verifyToken`), web 8 (new: 4
  route tests). `pnpm --filter @pantry/web build` passes.
  - Backend: per-tool `convex-test`; a cross-workspace "not found" check for every tool (spaces, projects,
    statuses, labels and issues of a second workspace); sub-issue space and project inheritance (and following a
    parent's project change); project lookup by name with the valid-names error; a revoked token rejected by all
    seven functions; the 10-minute throttle with fake timers.
  - Handler tests: the real `createMcpHandler` + `withMcpAuth` with a stub `authInfo`, driven by the MCP client
    SDK over an in-process fetch. Route tests: 401 with no token or a revoked one, 200 with a live one, 503 with
    no Convex URL.
- **End to end, locally:** `next build && next start` on :3300 against a fresh anonymous Convex backend on
  :3330/:3331 (`SITE_URL=http://localhost:3300`).
  1. Set up the owner in the browser (Playwright), created PAN-1 with the New issue dialog, and created a token
     in Settings → API tokens (read from the page).
  2. **MCP client SDK (2.4.0) script** with that token, all OK: tools/list showed the 7 tools; `get_issue PAN-1`;
     `get_space_context PAN`; `update_issue` → In Progress; `add_comment` (markdown); `create_sub_issue` → PAN-2
     (space PAN, parent PAN-1); `update_issue` → In Review. Extras: `status: "Doing"` came back as `isError` with
     the six status names, and `list_issues` worked.
  3. **Real Claude Code (2.1.310):** `claude mcp add --scope project --transport http pantry … --header
     "Authorization: Bearer …"` in a scratch folder. Project-scoped servers need interactive approval, so the run
     was `claude -p … --mcp-config <that .mcp.json> --strict-mcp-config --tools "" --model claude-haiku-5-5`,
     limited to the Pantry tools. On PAN-3 (created through `issues.create`), it read the issue, read the context
     doc, moved PAN-3 to In Progress, commented its plan, created sub-issue PAN-4 and moved PAN-3 to In Review.
  4. **Browser:** PAN-1 and PAN-3 show each status change and the comment under "Kris", tagged **via MCP**. The
     creation, done in the app, has no tag. The `activity` table has `via: "mcp"` on every MCP write
     (status changes, comments, sub-issue `created`) and `app` on the app's creations. The comment link scrolls
     to the comment. The token list showed "Used 2 min. ago".
  5. **Revoke:** revoked the token in the UI (confirm dialog). The next raw POST got **401**, and the SDK client
     failed with 401.
- Screenshots (2×, `docs/screenshots/`): `m4-tokens-claude-code-{light,dark}`, `m4-tokens-cursor-{light,dark}`,
  `m4-tokens-revoke-dark`, `m4-issue-via-mcp-{light,dark}`, `m4-issue-via-mcp-timeline-{light,dark}`. The tokens
  shown in them came from the throwaway local backend and were revoked straight away. That backend's data was
  then deleted.

## M4 acceptance criteria

| Criterion | Status |
|---|---|
| Create, name, revoke and list tokens | ✔ UI and tests |
| A revoked token gets 401 on the next call | ✔ locally (route test and a live server) |
| The seven tools pass `convex-test` and handler tests | ✔ |
| Claude Code, using the snippet, completes the script on a real issue; each step shows "via MCP" under your name | ✔ locally (headless Claude Code, local backend). **Pending on your instance: task 5** |

## Not verified

- Anything on your instance (`pantry-teal-kappa.vercel.app`): the deploy, Claude Code there, Cursor at all.
- An interactive Claude Code session with `claude mcp add` at the default local scope. Locally I used project
  scope plus `--mcp-config`; it's the same transport and header.
- MCP clients on the 2026-07-28 protocol revision. The SDK client negotiated 2025-11-25; I didn't log which
  revision Claude Code used. mcp-handler serves both.
- Behaviour on Vercel's runtime (only `next start` locally) and under concurrent agents.
