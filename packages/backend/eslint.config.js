import convexPlugin from "@convex-dev/eslint-plugin";
import { base } from "@pantry/eslint-config/base";

export default [...base, ...convexPlugin.configs.recommended];
