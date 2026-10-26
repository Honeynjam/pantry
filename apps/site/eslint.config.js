import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { base } from "@pantry/eslint-config/base";
import { boundaries } from "@pantry/eslint-config/boundaries";

const config = [
  ...base,
  ...nextVitals,
  ...nextTs,
  // The landing page uses motion directly (scroll and in-view reveals), so only the backend rule applies.
  ...boundaries({ backend: true }),
  { ignores: [".next/**", ".next-*/**", "next-env.d.ts"] },
];

export default config;
