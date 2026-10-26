# packages/app: client-only screens

The React screens shared by apps/web and the Mac app (apps/desktop). The root AGENTS.md still applies; these rules
are on top of it.

## Rules

- Client-only: no next/* imports, no server components. It must build statically for Tauri. Routing goes through
  the helpers in src/navigation.tsx and src/routes.ts; src/routes.ts stays a plain module (no "use client") so
  server pages in apps/web can import it.
- No business logic here: read and write through the Convex functions in packages/backend.
- Optimistic updates always build new objects; never mutate what localStore.getQuery returns. Issue writes go
  through src/issues/actions.ts so every view gets the same behaviour.
- Keyboard shortcuts are registered only through the shortcut registry in packages/app (it also drives the ? help).
- Build screens from packages/ui components and tokens, animate with its motion tokens, and give every animation
  a reduced-motion branch (packages/ui/AGENTS.md).

## Working here

- Tests are vitest (`pnpm test`). Check UI changes in light and dark, and with reduced motion on.
