import { boundaries } from "@pantry/eslint-config/boundaries";
import { react } from "@pantry/eslint-config/react";

export default [
  ...react,
  ...boundaries({ backend: true, clientOnly: true, motion: true, shortcuts: true }),
];
