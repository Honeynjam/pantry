# Spike: Tauri sign-in with Better Auth (M2 task 2)

Date: 26 Oct 2026. Branch `m2/desktop-spike-and-sync`. Versions: Tauri 2.12 (CLI/API 2.12.4, crate 2.12.5),
Rust 1.99, `@convex-dev/better-auth` 0.12.6, `better-auth` 1.6.33, macOS 26.6 (arm64).

## Result

**It works against a local backend.** A Tauri v2 build loads a static Vite build of the `packages/app` screens.
In it, the shared sign-in screen signs in with email and password through Better Auth's cross-domain plugin,
and the authenticated `workspace.current` query returns the workspace. The session survives an app relaunch.

Evidence (local anonymous Convex backend on 127.0.0.1:3262/3263, debug build run as a plain binary):

```
[pantry-spike] origin=tauri://localhost | server=http://127.0.0.1:3262 | session=none | convexAuth=false | setup.status={"isMember":false,…,"signedIn":false} | workspace.current=none
[pantry-spike] origin=tauri://localhost | … | session=spike-owner@example.com | convexAuth=true | setup.status={"isMember":true,…,"signedIn":true} | workspace.current=none
[pantry-spike] origin=tauri://localhost | … | session=spike-owner@example.com | convexAuth=true | … | workspace.current=Spike workspace (1 projects, 6 statuses, me: owner)
```

- Screenshot from inside the app (WKWebView snapshot): [`tauri-auth/tauri-signed-in.png`](tauri-auth/tauri-signed-in.png).
  The status card in the bottom right shows the webview origin, the server, the Better Auth session and the
  `workspace.current` result.
- Relaunching without credentials goes straight back to the signed-in workspace (the session is in the
  webview's localStorage).
- The web app still works with the backend changes. A fresh browser can sign up through setup and sign in
  again, using cookies through the `/api/auth` proxy ([`tauri-auth/web-after-setup.png`](tauri-auth/web-after-setup.png)).

**Re-checked after merging `m2/core` into `main`** (the spike's `ConvexBetterAuthProvider` replaced by Pantry's
bridge): same build steps, local backend on 127.0.0.1:3220/3221, owner account created on the web. Sign-in from
the app reached `workspace.current=Home (1 projects, 6 statuses, me: owner)`, and a relaunch without credentials
went straight back to it.

**Not yet tested against the deployed instance** (spec criterion). The steps for Kris are at the end of this doc.

## What the backend needs (all three are required)

| Change | Where | Why |
|---|---|---|
| `crossDomain({ siteUrl })` plugin, listed before `convex()` | `packages/backend/convex/auth.ts` | A webview at `tauri://localhost` can't keep a cookie for `*.convex.site` (the client sends `credentials: "omit"`). The plugin swaps cookies for headers: the server reads the session from a `Better-Auth-Cookie` request header and returns new cookies in `Set-Better-Auth-Cookie`. Checked by removing it: sign-in submits, but the app never gets a session. |
| `"tauri://localhost"` in `trustedOrigins` (`DESKTOP_ORIGINS`) | `auth.ts` | Better Auth's CSRF check validates the `Origin` of sign-in requests that carry Fetch Metadata, and WebKit sends them. Custom schemes match by prefix (`url.startsWith(pattern)`), so the plain string is enough. The same list drives CORS (next row). |
| `registerRoutesLazy(http, createAuth, { cors: true })` | `packages/backend/convex/http.ts` | The webview calls `https://<deployment>.convex.site/api/auth/*` directly, so preflights need an answer. With `cors: true` the component registers OPTIONS routes and allows exactly the `trustedOrigins` (exact string match), with `Better-Auth-Cookie` allowed and `Set-Better-Auth-Cookie` exposed. Checked: `Origin: tauri://localhost` gets `access-control-allow-origin: tauri://localhost`, and `https://evil.example` and `http://127.0.0.1:1430` get no allow-origin header. |

**Backward compatible with the web app.** The cross-domain plugin's header handling only runs on requests that
send `Better-Auth-Cookie`, and the web client never sends it: the web keeps first-party cookies through its
same-origin `/api/auth` proxy. The plugin also rewrites relative `callbackURL`s to `SITE_URL` (the web passes
none) and sets `skipStateCookieCheck` for OAuth state (no OAuth in v0.1; recheck if Q2 b adds GitHub OAuth).
CORS headers on the auth routes don't change same-origin traffic.

**No new env vars.** `SITE_URL` and `BETTER_AUTH_SECRET` stay as they are. The Tauri origin is the same on every
Mac, so it's a constant in code, not per-instance config.

**Client side** (`packages/app`): `createPantryAuthClient(baseURL, { crossDomain: true })` adds
`crossDomainClient()`, and `PantryProviders` takes `authBaseUrl` (the `.convex.site` URL) and `crossDomain`. The
web app passes neither, so nothing changes there. With `crossDomain`, the bridge also does the one thing
`ConvexBetterAuthProvider` added on top of the plugin: if the page loads with `?ott=` (a one-time token from a
redirect-based sign-in, e.g. OAuth later), it strips it from the URL, verifies it and refreshes the session
(`packages/app/src/cross-domain.ts`). Email and password sign-in doesn't use it.

## Trusted origins

| Origin | When | Trusted? |
|---|---|---|
| `tauri://localhost` | Any built app on macOS (`tauri build`, debug or release): assets are served over Tauri's custom protocol | **Yes**, needed |
| `http://127.0.0.1:1430` | `tauri dev` with no `devUrl`: the CLI serves `frontendDist` from its own dev server on port 1430 | No. Don't trust localhost ports in production. Use a built binary to test sign-in, even during development. |
| `http://localhost:<vite port>` | `tauri dev` with a `devUrl` (Vite HMR) | No, same reason. For HMR against a local backend, set the local deployment's `SITE_URL` to that origin. |
| `http://tauri.localhost` | Windows builds | Not listed: the app is Mac only. |

## Cookie vs token handling

- The session lives in the webview's `localStorage` (keys `better-auth_cookie` and `better-auth_session_data`),
  in WebKit's data folder (`~/Library/WebKit/<binary name or bundle id>/WebsiteData`). It's plain text on disk,
  readable by anything running as the user. Fine for the spike, **not for M5**: the spec puts session tokens in
  the Keychain.
- The Convex JWT is fetched by Pantry's own Convex ↔ Better Auth bridge (`packages/app/src/convex-auth.tsx`, the
  single auth path for web and Mac since the M2 merge) through `authClient.convex.token()`. That request goes
  through the auth client's fetch, so the cross-domain plugin adds the same `Better-Auth-Cookie` header and Convex
  auth needs no Tauri-specific work. The bridge's timeouts and retries apply here too.
- Sign-out (user menu) clears both keys locally and revokes the session on the server.

## Blockers and gotchas found

1. **`tauri dev` has a different origin.** Without a `devUrl`, `tauri dev` serves the static build from
   `http://127.0.0.1:1430`, not `tauri://localhost`, so sign-in fails there by design. Use
   `pnpm --filter @pantry/desktop tauri:build` and run the binary.
2. **No screenshots from outside the app.** `screencapture` needs Screen Recording permission, which this
   session doesn't have. The debug build snapshots its own WKWebView instead (`src-tauri/src/spike.rs`).
3. **The `tauri-driver` WebDriver isn't available on macOS**, so the end-to-end run uses a debug-only hook: with
   `PANTRY_SPIKE_EMAIL`/`PANTRY_SPIKE_PASSWORD` set, it fills in and submits the real sign-in form. M5 needs a test
   strategy, e.g. Playwright against the same static build in a browser, plus a short manual checklist for the
   Tauri-only parts.
4. **CSP:** Tauri adds hashes to `style-src`, and with hashes present browsers ignore `'unsafe-inline'`. Base UI
   and motion set inline styles, so the spike sets `dangerousDisableAssetCspModification: ["style-src"]`. Its
   `connect-src` only covers `*.convex.cloud` / `*.convex.site` and 127.0.0.1. Self-hosted Convex on a custom
   domain would need `https: wss:`.
5. Not a blocker: the Mac needed Rust (installed with rustup, user-level, no PATH or profile changes:
   `~/.cargo/bin`). Xcode Command Line Tools were already installed. The first Rust build takes about 1 minute,
   rebuilds take seconds.

## Recommendations for M5

1. **Keep the three backend changes** as they are (they're small and web-safe). If Windows ever ships, add
   `http://tauri.localhost` to `DESKTOP_ORIGINS`.
2. **Keychain-backed storage for the cross-domain client.** `crossDomainClient({ storage })` accepts a custom
   storage, but it calls `getItem` synchronously. So: at startup, read the active server's entry from the Keychain
   (the `session_get` Tauri command over the `keyring` crate, spec §8) into an in-memory map before rendering. Then
   serve `getItem` from the map and write `setItem` through to `session_set`. Use one storage per server id, and
   use the `storagePrefix` option to keep servers apart.
3. **Server URL at runtime.** Replace the spike's build-time `PANTRY_SERVER_URL` with the first-launch screen.
   It reads `GET /api/instance` (already CORS `*`) for `convexUrl` / `convexSiteUrl`, then creates the Convex and
   auth clients per server.
4. **Routing:** the spike's in-memory `Navigation` is enough to run the shared screens. M5 should use a hash or
   memory router behind the same `Navigation` interface, since the custom protocol serves a single `index.html`.
5. **Dev loop:** a Vite `devUrl` with HMR for UI work against a local backend whose `SITE_URL` is the Vite origin,
   and a built binary for anything auth-related against a deployed instance.
6. **Delete** `src-tauri/src/spike.rs`, the `objc2*` / `block2` / `serde_json` crates and `SpikeStatus` when M5
   starts. Pick the final bundle identifier (the spike uses `com.honeynjam.pantry.spike` so its data stays apart).

## How to run it

```bash
# Local backend (anonymous, no login). Use other ports if 3210/3211 are taken:
cd packages/backend
CONVEX_AGENT_MODE=anonymous npx convex dev --local-cloud-port 3262 --local-site-port 3263
npx convex env set SITE_URL http://localhost:3251        # the web origin you'll set up the account on
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
# Create the owner account on the web (setup screen), e.g.
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3262 NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3263 \
  NEXT_DIST_DIR=.next-spike pnpm --filter @pantry/web exec next dev --port 3251

# The app (needs Rust: https://rustup.rs). Reads the local backend URL from packages/backend/.env.local.
pnpm --filter @pantry/desktop tauri:build          # vite build + debug binary, no bundle, no signing
apps/desktop/src-tauri/target/debug/pantry-desktop

# Automated variant used for the evidence above (debug builds only):
PANTRY_SPIKE_EMAIL=… PANTRY_SPIKE_PASSWORD=… PANTRY_SPIKE_SNAPSHOT=/tmp/pantry.png PANTRY_SPIKE_EXIT=1 \
  apps/desktop/src-tauri/target/debug/pantry-desktop
```

None of this is part of `pnpm turbo typecheck lint test`: `apps/desktop` only typechecks and lints its
TypeScript, and the Rust build runs only through the `tauri:*` scripts.

## Steps for Kris: test against https://pantry-teal-kappa.vercel.app

The live instance needs the backend changes first. Nothing else changes: no env vars, no Vercel settings.

1. **Deploy the backend changes.** They're on `main` now (`packages/backend/convex/auth.ts` and `http.ts`, plus
   the `packages/app` changes): push `main`. Vercel's normal build runs `convex deploy`. `SITE_URL` stays
   `https://pantry-teal-kappa.vercel.app`, set by the build as before.
2. **Check that the deploy took.**
   ```bash
   SITE=$(curl -s https://pantry-teal-kappa.vercel.app/api/instance | python3 -c 'import json,sys; print(json.load(sys.stdin)["convexSiteUrl"])')
   curl -si -X OPTIONS "$SITE/api/auth/sign-in/email" -H "Origin: tauri://localhost" -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin
   ```
   Success: `access-control-allow-origin: tauri://localhost`. No such line means the new functions aren't
   deployed yet.
3. **Check the web still works:** open https://pantry-teal-kappa.vercel.app, sign out, and sign in again.
4. **Build the app pointed at the live instance** (needs Rust; `rustup` if `cargo --version` fails):
   ```bash
   pnpm i
   PANTRY_SERVER_URL=https://pantry-teal-kappa.vercel.app pnpm --filter @pantry/desktop tauri:build
   apps/desktop/src-tauri/target/debug/pantry-desktop
   ```
   Use `tauri:build` and not `tauri:dev`: dev mode serves from `http://127.0.0.1:1430`, which the server rightly
   rejects. The build reads `/api/instance` once to find the Convex URLs; if it says "not a Pantry server", check
   the URL.
5. **Sign in** in the window with your normal account.
6. **Success looks like:** your workspace's Home screen (your workspace name, your projects, the six statuses). The
   status card in the bottom right reads `origin tauri://localhost`, `server https://pantry-teal-kappa.vercel.app`,
   `session <your email> · convex auth true`, and `workspace.current <your workspace> (… me: owner)`. The terminal
   prints the same as `[pantry-spike] …` lines. Quit and relaunch: you should still be signed in. Optional: add
   `PANTRY_SPIKE_SNAPSHOT=~/Desktop/pantry-live.png` to the launch command to get a screenshot once the workspace
   loads.
7. **If it fails:** the terminal lines show where it stopped. `session=none` after submitting means a CORS or origin
   rejection (re-run step 2, and check the Convex dashboard logs for `Invalid origin`). A session with
   `convexAuth=false` means the JWT step failed (check the Convex logs for `/api/auth/convex/token`).
8. **Clean up:** sign out from the user menu (revokes the session), or delete
   `~/Library/WebKit/pantry-desktop`.
