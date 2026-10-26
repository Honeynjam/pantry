import * as React from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@pantry/ui/components/avatar";
import { cn } from "@pantry/ui/lib/utils";

export type AvatarPerson = { id?: string; name: string; avatarUrl?: string };

/** "Kris Example" → "KE"; "kris" → "K". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

function PersonAvatar({
  person,
  size = "default",
  className,
}: {
  person: AvatarPerson;
  size?: React.ComponentProps<typeof Avatar>["size"];
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
      <AvatarFallback>{initials(person.name)}</AvatarFallback>
    </Avatar>
  );
}

/** Overlapping avatars with a "+N" counter after `max`. */
function AvatarStack({
  people,
  max = 3,
  size = "default",
  className,
}: {
  people: AvatarPerson[];
  max?: number;
  size?: React.ComponentProps<typeof Avatar>["size"];
  className?: string;
}) {
  const shown = people.slice(0, max);
  const hidden = people.length - shown.length;
  return (
    <AvatarGroup
      className={cn(className)}
      aria-label={people.map((person) => person.name).join(", ")}
    >
      {shown.map((person, index) => (
        <PersonAvatar key={person.id ?? `${person.name}-${index}`} person={person} size={size} />
      ))}
      {hidden > 0 && <AvatarGroupCount data-size={size}>+{hidden}</AvatarGroupCount>}
    </AvatarGroup>
  );
}

export { AvatarStack, PersonAvatar };
