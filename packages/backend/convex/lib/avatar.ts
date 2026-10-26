import { v, type Infer } from "convex/values";

/**
 * A space's avatar: which pantry cutout, which label colour and which eyes. The names match
 * packages/ui/src/lib/pantry-avatars.ts; they're spelled out as literals so TypeScript fails in
 * packages/app if the two lists drift. Spaces without one get a look seeded from their key.
 */
export const avatarValidator = v.object({
  shape: v.union(
    v.literal("toast"),
    v.literal("loaf"),
    v.literal("jam"),
    v.literal("honey"),
    v.literal("egg"),
    v.literal("cookie"),
    v.literal("cheese"),
    v.literal("milk"),
    v.literal("muffin"),
    v.literal("sack"),
    v.literal("bottle"),
  ),
  color: v.union(
    v.literal("red"),
    v.literal("orange"),
    v.literal("yellow"),
    v.literal("lime"),
    v.literal("green"),
    v.literal("teal"),
    v.literal("blue"),
    v.literal("indigo"),
    v.literal("violet"),
    v.literal("pink"),
  ),
  expression: v.union(
    v.literal("curious"),
    v.literal("dots"),
    v.literal("tall"),
    v.literal("happy"),
    v.literal("sleepy"),
    v.literal("grumpy"),
    v.literal("wink"),
    v.literal("surprised"),
  ),
});

export type SpaceAvatar = Infer<typeof avatarValidator>;
