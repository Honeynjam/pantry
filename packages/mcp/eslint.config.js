import { base } from "@pantry/eslint-config/base";
import { boundaries } from "@pantry/eslint-config/boundaries";

export default [...base, ...boundaries({ backend: true, motion: true })];
