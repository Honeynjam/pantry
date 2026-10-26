# packages/ui: design system and motion

Tokens, theme, components (shadcn/ui on Base UI, restyled to our tokens), motion tokens and the Markdown editor.
The root AGENTS.md still applies; these rules are on top of it.

## Design rules

- Use the components here before writing new UI, and restyle anything added from shadcn to our tokens: no
  stock-looking shadcn. New components are built on Base UI.
- Dense and monochrome, like Linear: 13px UI text, 12px metadata, mono for issue keys, timestamps and shortcuts;
  hairline borders and surface steps instead of shadows. Colour only in status, priority and label glyphs. Both
  themes are first-class.
- Colours, radii and spacing come from the tokens in src/styles/globals.css, never raw values.
- A visible focus ring for keyboard focus (:focus-visible) only.
- Every new token or component goes on the /design review page (src/design/), in light and dark.

## Motion rules

- Animate only with the motion tokens in src/lib/motion.ts (springs smooth / snappy / morph, the durations and
  eases) or their CSS mirrors in globals.css (`--duration-*`, `--ease-*`).
- Animate transform and opacity; one continuous movement per state change; springs for anything the user can
  reverse; exits faster than entrances; presses scale to pressScale, except elements that anchor a menu or popover.
  No scroll reveals or decorative loops.
- Every animation has a reduced-motion branch that keeps the end state and feedback and drops the travel:
  useMotionTransition / usePrefersReducedMotion in JS, a prefers-reduced-motion block in CSS.

## Working here

- The Markdown editor must round-trip agents' Markdown: untouched blocks are saved byte for byte. The fixtures in
  test/fixtures/markdown are exact on purpose; don't reformat them.
- Tests are vitest with happy-dom (`pnpm test`).
