import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { base } from "./base.js";

/** Flat config for client React packages (packages/ui, packages/app). */
export const react = [
  ...base,
  reactHooks.configs.flat["recommended-latest"] ?? reactHooks.configs["recommended-latest"],
  {
    languageOptions: { globals: { ...globals.browser } },
  },
];

export default react;
