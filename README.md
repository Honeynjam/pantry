# Pantry

A fast, keyboard-first, open-source (MIT) issue tracker for 1–3 person teams working with AI coding agents.
Your agents read and update issues over MCP; your data lives in your own Vercel and Convex accounts.

> Status: early development (milestone M1). The Deploy button below is being tested on a fresh account.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhoneynjam%2Fpantry&project-name=pantry&repository-name=pantry&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22convex%22%2C%22productSlug%22%3A%22convex%22%2C%22protocol%22%3A%22storage%22%7D%5D)

## Deploy your own (about 5 minutes)

You need a GitHub account. Vercel and Convex accounts are created along the way (both free for personal use;
Vercel Hobby is for non-commercial use).

1. **Click "Deploy with Vercel"** above and sign in to Vercel with GitHub.
2. **Repository:** Vercel copies this repo into your GitHub account (a clone, not a fork). Keep the name or change it.
3. **Root Directory: set it to `apps/web`.** This is the one setting the button can't fill in for you; if you
   miss it, the first build stops with a message telling you how to fix it in Settings. In the
   "Configure Project" form, find **Root Directory**, click **Edit**, pick `apps/web`, and confirm. Leave the
   build and install settings alone: `apps/web/vercel.json` provides the build command.
4. **Add the Convex integration** when Vercel asks (it's pre-selected by the button): accept the terms and create a
   new Convex project. Keep both **Production** and **Preview** enabled and leave **Custom Prefix** empty.
   This gives the build a `CONVEX_DEPLOY_KEY`.
5. **Deploy.** The build deploys your Convex functions, creates a `BETTER_AUTH_SECRET` on your Convex deployment
   (once; it survives redeploys), points Convex `SITE_URL` at your production URL, and builds the web app.
6. **Open your production URL** (`https://<project>.vercel.app`). You'll see the setup screen: create your
   account and workspace. You become the owner; from then on sign-up is invite-only.

If the setup screen says **"One more step"**, the deploy key wasn't allowed to set environment variables. Copy the
one-line command it shows (run it from `packages/backend` in a clone, with `--prod`), or add `BETTER_AUTH_SECRET`
in the Convex dashboard → Settings → Environment Variables, then reload.

Only production deploys run (preview builds are skipped by `ignoreCommand` in `apps/web/vercel.json`), so previews
never touch your Convex data. Every push to your repo's production branch redeploys web + Convex together.

### Troubleshooting

| Symptom | Fix |
|---|---|
| Build log: `CONVEX_DEPLOY_KEY is not set` | Connect the Convex integration to the project for Production and Preview, with no Custom Prefix, then redeploy. |
| Build fails with "Pantry must be built from apps/web", "No Output Directory named public", "No Next.js version detected" or can't find `scripts/vercel-build.sh` | Root Directory isn't `apps/web`. Project → Settings → Build and Deployment → Root Directory → `apps/web`, then redeploy. |
| App is blank or says "This app has no Convex address" | `NEXT_PUBLIC_CONVEX_URL` wasn't injected: the build command must be `bash ../../scripts/vercel-build.sh` (from `apps/web/vercel.json`). |
| Sign-in fails with an origin or URL error | Convex `SITE_URL` must match the URL you opened. Use the production URL, not a deployment-specific one; after adding a domain, redeploy. |
| Setup screen: "One more step" | See above: set `BETTER_AUTH_SECRET` once. `GET /api/instance` shows `"needsSecret": false` when it's fixed. |
| Vercel can't connect the repo | Hobby can't use repos owned by a GitHub organisation; clone into a personal account. |
| You hit a Convex free-plan limit | Convex dashboard → Usage. A runaway agent loop is the usual cause; revoke its token. |

`GET https://<your-app>/api/instance` returns `{ name, convexUrl, convexSiteUrl, serverVersion, minAppVersion,
needsSecret }`; it's the quickest health check.

### Updating your instance

The Deploy button copies this repo into your account; it doesn't fork it, so GitHub has no "Sync fork" button for
it. Your copy includes a **Sync upstream** workflow (`.github/workflows/sync-upstream.yml`) for that. Every Monday,
or whenever you run it, it opens a pull request in your repo that updates it to the latest Pantry release.
**Merging the PR deploys the update** (Vercel rebuilds the web app and pushes the new Convex functions). Nothing
changes until you merge: the workflow never merges by itself. To skip a release, close its PR; the workflow won't
reopen it.

1. **One-time setting:** in your repo, Settings → Actions → General → Workflow permissions, turn on **"Allow GitHub
   Actions to create and approve pull requests"**. Without it the workflow pushes its branch but can't open the PR.
2. **Run it now (optional):** Actions → Sync upstream → Run workflow. Leave "tag" empty for the latest release, or
   tick "dry run" to see what it would do without pushing anything.
3. **Review and merge** the "Update Pantry to vX.Y.Z" PR.

Good to know:
- **The first update replaces files.** Your copy and Pantry don't share git history, so the first PR takes the
  release's files as they are. If you edited files yourself, those edits show up in its diff as removed; put
  them back on the PR branch before merging. After that the histories are linked, and later updates are normal
  merges that keep your changes (GitHub shows any conflicts in the PR).
- **Releases that change `.github/workflows`.** GitHub won't let the built-in token push changes to workflow
  files, and the run then fails with an error that says so. Fix: create a fine-grained personal access token for
  this repo only, with *Contents*, *Pull requests* and *Workflows* set to read and write. Save it as the repository
  secret `SYNC_UPSTREAM_TOKEN` and run the workflow again; it uses that token whenever the secret exists.
- PRs opened with the built-in token don't trigger other workflows, so CI doesn't run on them. Vercel still
  deploys once you merge.
- GitHub pauses scheduled workflows in repos with no activity for 60 days. Re-enable it on the Actions tab, or
  just run it by hand.
- Prefer a real fork? Fork the repo first and import the fork into Vercel. The same workflow works there too.
- In `honeynjam/pantry` itself the workflow does nothing.

Maintainers can test the workflow locally (no Docker; throwaway repos and a stub `gh`):
`bash scripts/test-sync-upstream.sh`.

## Develop locally

Requirements: Node 24 (`nvm use`), pnpm 10 (`corepack enable` or `npm i -g pnpm@10`). No Convex account needed.

```bash
pnpm i
pnpm dev                       # local Convex backend (no login) + web on http://localhost:3000
```

The first time, give the local Convex deployment its two auth settings (local deployment only):

```bash
cd packages/backend
npx convex env set SITE_URL http://localhost:3000
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
```

Then open http://localhost:3000: the setup screen creates your account and workspace.

- `pnpm dev` runs `convex dev` with `CONVEX_AGENT_MODE=anonymous` (a local backend on 127.0.0.1:3210/3211). Set
  `CONVEX_AGENT_MODE=` (empty) to use your own Convex dev deployment instead.
- The web app reads the Convex URLs that `convex dev` writes to `packages/backend/.env.local`, so there's nothing
  to copy. `apps/web/.env.local` overrides them if you need to.
- To run a second web dev server from the same folder (Next allows one per build directory), give it its own
  directory: `NEXT_DIST_DIR=.next-2 pnpm --filter @pantry/web exec next dev --port 3001`. If you sign in there,
  set `SITE_URL` to that origin.

### Checks (what CI runs)

```bash
pnpm turbo typecheck lint test
```

### Design system review page

`packages/ui` holds the tokens, theme provider, motion tokens and components. A dev-only page shows all of them in
light and dark: open http://localhost:3000/design while `pnpm dev` runs. Production builds return 404 for `/design`
unless `PANTRY_DESIGN_PAGE=1` is set at build time.

## Repo layout

| Path | What |
|---|---|
| `apps/web` | Next.js App Router web app (Vercel): renders `packages/app`, `/api/auth`, `/api/instance` (`/api/mcp` in M4) |
| `apps/desktop` | Tauri v2 Mac app. For now the M2 sign-in spike: see [`docs/spikes/tauri-auth.md`](docs/spikes/tauri-auth.md) (needs Rust; not part of the default checks) |
| `packages/backend` | Convex functions, schema and Better Auth (`convex/`). All business logic lives here |
| `packages/app` | Client-only React screens (shared by web and the Mac app) |
| `packages/ui` | Design system: tokens, theme, shadcn/ui components on Base UI, motion tokens |
| `packages/mcp` | MCP tool definitions (M4) |
| `packages/tsconfig`, `packages/eslint-config` | Shared config |
| `scripts/vercel-build.sh` | The Vercel build: Convex env, `convex deploy`, web build |
| `.github/workflows` | CI (typecheck, lint, test) and Sync upstream (update PRs for self-hosted copies) |
| `docs/` | Spec (`PANTRY-SPEC.md`), milestone notes, deploy test checklist |

## Licence

MIT, see [LICENSE](LICENSE).
