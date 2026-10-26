import { boundaries } from "@pantry/eslint-config/boundaries";
import { react } from "@pantry/eslint-config/react";

export default [
  { ignores: ["src-tauri/target/**", "src-tauri/gen/**"] },
  ...react,
  ...boundaries({ backend: true, motion: true }),
];
