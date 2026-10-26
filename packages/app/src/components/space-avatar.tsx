import type { Doc } from "@pantry/backend/dataModel";
import { PantryAvatar } from "@pantry/ui/components/pantry-avatar";
import { pickPantryAvatar, type PantryAvatarValue } from "@pantry/ui/lib/pantry-avatars";
import type { ComponentProps } from "react";

type SpaceLike = Pick<Doc<"spaces">, "key"> & Partial<Pick<Doc<"spaces">, "avatar">>;

/** The space's chosen avatar, or the one seeded from its key for spaces that never chose. */
export function spaceAvatar(space: SpaceLike): PantryAvatarValue {
  if (space.avatar) return space.avatar;
  const { shape, color, expression } = pickPantryAvatar(space.key);
  return { shape, color, expression };
}

export function SpaceAvatar({
  space,
  ...props
}: { space: SpaceLike } & Omit<ComponentProps<typeof PantryAvatar>, "seed" | "shape" | "color" | "expression">) {
  return <PantryAvatar seed={space.key} {...spaceAvatar(space)} {...props} />;
}
