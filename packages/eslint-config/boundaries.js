import { readFileSync } from "node:fs";

/**
 * Architecture rules from AGENTS.md, enforced by lint. Each package's eslint.config.js picks the ones
 * that apply to it through `boundaries({ ... })`.
 *
 * Flat config doesn't merge options of the same rule across config objects (the last one wins), so
 * every import restriction for a package is built into one `@typescript-eslint/no-restricted-imports`
 * entry here, and the exceptions (tests, the shortcut registry) restate the list minus what they may use.
 */

const see = "See AGENTS.md.";

const tsFiles = ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"];
const testFiles = ["**/*.test.{ts,tsx}"];

/** The shortcut registry: the only files in packages/app that may listen for keys (M3, spec §4). */
export const shortcutRegistryFiles = [
  "src/shortcuts.ts",
  "src/use-shortcuts.ts",
  "src/shortcuts/**",
];

// Only the entry points @pantry/backend lists in package.json "exports" may be imported, so adding an
// export there is the one deliberate step that makes a new one importable.
const backendExports = Object.keys(
  JSON.parse(readFileSync(new URL("../backend/package.json", import.meta.url), "utf8")).exports ??
    {},
)
  .filter((key) => key.startsWith("./"))
  .map((key) => `@pantry/backend/${key.slice(2)}`);

const backendMessage = `Import @pantry/backend only through its package.json exports (${backendExports
  .map((name) => name.replace("@pantry/backend/", ""))
  .join(", ")}); business logic stays in Convex functions. ${see}`;

const clientOnlyMessage = `packages/app and packages/ui are client-only (they build statically for Tauri): no Next.js, server-only or convex/server runtime imports. ${see}`;

const motionMessage = `Animate with the motion tokens from @pantry/ui/lib/motion (it also exports \`motion\`); only packages/ui imports motion directly. ${see}`;

const shortcutMessage = `Register keyboard shortcuts in the shortcut registry (packages/app/src/shortcuts), not with your own key listener. ${see}`;

function restrictions({ backend, clientOnly, motion, shortcuts, test }) {
  const paths = [];
  const patterns = [];
  if (backend) {
    patterns.push(
      {
        group: ["@pantry/backend/*", ...backendExports.map((name) => `!${name}`)],
        message: backendMessage,
      },
      // Relative paths into packages/backend (the group above covers the package name).
      { regex: "^[./].*/backend/convex(/|$)", message: backendMessage },
    );
  }
  if (clientOnly) {
    paths.push(
      { name: "next", message: clientOnlyMessage },
      { name: "server-only", message: clientOnlyMessage },
    );
    patterns.push({ group: ["next/*"], message: clientOnlyMessage });
    // Types from convex/server (FunctionReturnType, FunctionArgs) are erased at build time, and tests
    // run under Node, so both may use it.
    if (!test)
      paths.push({ name: "convex/server", message: clientOnlyMessage, allowTypeImports: true });
  }
  if (motion) {
    patterns.push({ regex: "^(motion|framer-motion)(/|$)", message: motionMessage });
  }
  if (shortcuts) {
    paths.push({ name: "tinykeys", message: shortcutMessage });
  }
  return ["error", { paths, patterns }];
}

const keyListener = {
  selector:
    "CallExpression:matches([callee.name='addEventListener'], [callee.property.name='addEventListener'])[arguments.0.value=/^key(down|up)$/]",
  message: shortcutMessage,
};

/**
 * Config objects for one package. Options:
 * - `backend`: may only import @pantry/backend's exports (every package except backend itself).
 * - `clientOnly`: no next, next/*, server-only or convex/server runtime imports (packages/app, packages/ui).
 * - `motion`: no direct motion / framer-motion imports (everything except packages/ui).
 * - `shortcuts`: no keydown/keyup listeners or tinykeys outside the shortcut registry (packages/app).
 */
export function boundaries({
  backend = false,
  clientOnly = false,
  motion = false,
  shortcuts = false,
} = {}) {
  const options = { backend, clientOnly, motion, shortcuts };
  const configs = [
    {
      files: tsFiles,
      rules: { "@typescript-eslint/no-restricted-imports": restrictions(options) },
    },
  ];
  if (clientOnly) {
    configs.push({
      files: testFiles,
      rules: {
        "@typescript-eslint/no-restricted-imports": restrictions({ ...options, test: true }),
      },
    });
  }
  if (shortcuts) {
    configs.push(
      {
        files: tsFiles,
        ignores: shortcutRegistryFiles,
        rules: { "no-restricted-syntax": ["error", keyListener] },
      },
      {
        files: shortcutRegistryFiles,
        rules: {
          "@typescript-eslint/no-restricted-imports": restrictions({
            ...options,
            shortcuts: false,
          }),
        },
      },
    );
  }
  return configs;
}

export default boundaries;
