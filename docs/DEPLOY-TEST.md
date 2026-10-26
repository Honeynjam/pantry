# M1 deploy test (run by Kris on a fresh account)

Goal (spec §10b, M1 acceptance): a Deploy Button run on a fresh Vercel account reaches the setup screen; the first
sign-up becomes owner; a second sign-up without an invite is rejected; `/api/instance` answers; a redeploy keeps
`BETTER_AUTH_SECRET` (you stay signed in); button click to signed-in workspace takes under 10 minutes.

Nothing here has been run yet: it needs your accounts. Fill in the "Result" lines as you go.

## Before you start

1. Pick the GitHub repo and push `main` to it (public, so the Deploy Button can clone it).
2. Replace the placeholders listed under "Placeholders" below, commit and push.
3. Use a browser profile that is signed out of Vercel and Convex, and a GitHub account with no existing Vercel
   account (or a fresh one). Start a timer.

## Steps

1. Open the README on GitHub and click **Deploy with Vercel**.
2. Sign up to Vercel with GitHub. Let it create the repository copy in your account.
3. **Root Directory (route 1):** in "Configure Project", click **Edit** next to Root Directory and choose
   `apps/web`. Don't override build or install commands.
   - Result: Root Directory field offered? ☐ yes ☐ no → if no, see "Fallback (route 2)" below.
4. **Convex integration:** accept it, create a new Convex project. Confirm **Production** and **Preview** are
   both on and **Custom Prefix** is empty.
5. Click **Deploy** and open the build log. Look for these lines from `scripts/vercel-build.sh`:
   - `✔ Generated BETTER_AUTH_SECRET on the Convex deployment` → **the Marketplace key can set env vars**.
   - `⚠ Couldn't set BETTER_AUTH_SECRET …` or `⚠ Couldn't read Convex environment variables …` → it can't.
   - `✔ SITE_URL = https://<project>.vercel.app`
   - Also note the pnpm version Vercel used (first lines of the install step) and the Node version.
   - Result: secret line: ______ · SITE_URL line: ______ · pnpm: ______ · Node: ______
6. Open the **production URL** (not the deployment-specific URL).
   - Expected: the setup screen ("Set up Pantry"). If it says "One more step", the key couldn't set the secret:
     follow the screen (Convex dashboard → Settings → Environment Variables → `BETTER_AUTH_SECRET`), reload.
7. `https://<project>.vercel.app/api/instance` → expect `"needsSecret": false` and your `.convex.cloud` /
   `.convex.site` URLs.
8. Fill in the setup form → you land in the workspace with the sidebar, the `PAN` project and six statuses.
   Stop the timer. Result: ____ minutes (target: under 10).
9. In a private window, open `/sign-up` and try another email → expect "Sign-up is invite-only…".
10. **Redeploy keeps the secret:** Vercel → Deployments → ⋯ → Redeploy (production). When it finishes, reload the
    app in your signed-in window: you should still be signed in, and the build log should say
    `✔ BETTER_AUTH_SECRET is already set (kept)`.
11. Sign out and sign in again.

## Record the results

Add a short note to `docs/M1-PLAN.md` (or tell Claude Code): which Root Directory route worked, whether the
Marketplace key could set env vars, the pnpm/Node versions Vercel used, total time, and anything that surprised you.

## Fallback (route 2): Root Directory not offered

If the clone form has no Root Directory field, finish the import with defaults, then set it right after:
Project → Settings → Build and Deployment → **Root Directory** → `apps/web` → Save → Deployments → Redeploy.
If that also isn't possible, a root-level `vercel.json` is the spec's second route: tell Claude Code and it will add
one that installs with pnpm at the repo root and builds `apps/web` through the same script. It isn't in the repo
yet because route 1 is expected to work and an unused root config would be untested.

## Placeholders

| Where | Placeholder | Replace with |
|---|---|---|
| `README.md`, Deploy button URL (`repository-url=…`) | `OWNER%2FREPO` (URL-encoded `OWNER/REPO`) | your GitHub `owner/repo`, URL-encoded (`/` → `%2F`) |
| `README.md`, HTML comment above the button | `OWNER/REPO` | remove the comment once replaced |

The Deploy URL's `project-name=pantry` and `repository-name=pantry` are defaults the user can change in the form;
they're also part of the rename checklist (spec §10b "One place for the name").

## Package manager note (checked 26 Oct 2026)

Vercel's package-manager docs (updated 11 Aug 2026) now list pnpm 6–12 as supported, but the version still comes
from the lockfile: `lockfileVersion: 9.0` → "pnpm 9 or 10" (newer projects get 10). pnpm 11+ needs Corepack
(`ENABLE_EXPERIMENTAL_COREPACK=1`, still experimental), and community reports from June–August 2026 show pnpm 11
falling back to npm without it. So the repo stays on **pnpm 10.34.9**, which needs no extra env var on a fresh
account. Don't add an `installCommand` override: Vercel then uses the *oldest* pnpm in the image (pnpm 6).
