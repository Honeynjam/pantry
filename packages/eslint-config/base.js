import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

/** Shared flat config for every TypeScript package. */
export const base = tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.next-*/**",
      "**/.turbo/**",
      "**/_generated/**",
      "**/node_modules/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
    },
  },
  prettier,
);

export default base;
