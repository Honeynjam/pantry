import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { base } from "@pantry/eslint-config/base";
import { boundaries } from "@pantry/eslint-config/boundaries";

const config = [
  ...base,
  ...nextVitals,
  ...nextTs,
  ...boundaries({ backend: true, motion: true }),
  { ignores: [".next/**", ".next-*/**", "next-env.d.ts"] },
];

export default config;
