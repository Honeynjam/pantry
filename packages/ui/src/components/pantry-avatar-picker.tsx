"use client";

import * as React from "react";
import { CheckIcon, DicesIcon } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@pantry/ui/components/button";
import { PantryAvatar } from "@pantry/ui/components/pantry-avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@pantry/ui/components/popover";
import { labelColorVar } from "@pantry/ui/lib/issue-meta";
import { spring, useMotionTransition } from "@pantry/ui/lib/motion";
import {
  AVATAR_COLORS,
  AVATAR_EXPRESSIONS,
  PANTRY_EXPRESSION_NAMES,
  PANTRY_SHAPES,
  PANTRY_SHAPE_NAMES,
  randomPantryAvatar,
  type PantryAvatarValue,
} from "@pantry/ui/lib/pantry-avatars";
import { focusRing } from "@pantry/ui/lib/styles";
import { cn } from "@pantry/ui/lib/utils";

const option = cn(
  "flex items-center justify-center rounded-md transition-colors duration-(--duration-instant) hover:bg-accent aria-checked:bg-selected",
  focusRing,
);

/** The avatar, popping in when it changes (a fade under reduced motion). */
function Preview({
  value,
  seed,
  size,
}: {
  value: PantryAvatarValue;
  seed: string;
  size: "lg" | "xl";
}) {
  const transition = useMotionTransition(spring.snappy);
  return (
    <motion.span
      key={`${value.shape}-${value.color}-${value.expression}`}
      className="flex"
      initial={{ scale: 0.8, opacity: 0.4 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={transition}
    >
      <PantryAvatar seed={seed} {...value} size={size} />
    </motion.span>
  );
}

/**
 * The avatar as a button that opens a picker: shape, colour and eyes, plus a shuffle. Controlled;
 * `seed` keeps the avatar's tilt and blink steady while its look changes.
 */
function PantryAvatarPicker({
  value,
  onChange,
  seed,
  label = "Avatar",
  size = "lg",
  className,
}: {
  value: PantryAvatarValue;
  onChange: (value: PantryAvatarValue) => void;
  seed: string;
  label?: string;
  size?: "lg" | "xl";
  className?: string;
}) {
  const set = (patch: Partial<PantryAvatarValue>) => onChange({ ...value, ...patch });
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${label}: ${PANTRY_SHAPES[value.shape].name}, ${value.color}. Change`}
        className={cn(
          "hover:bg-accent aria-expanded:bg-accent flex shrink-0 items-center justify-center rounded-lg p-1 transition-colors duration-(--duration-instant)",
          focusRing,
          className,
        )}
      >
        <Preview value={value} seed={seed} size={size} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[21rem] gap-3">
        <div className="flex items-center gap-3">
          <Preview value={value} seed={seed} size="xl" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-foreground font-medium">{PANTRY_SHAPES[value.shape].name}</span>
            <span className="text-muted-foreground text-xs">
              {AVATAR_EXPRESSIONS[value.expression].name}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-icon="inline-start"
            onClick={() => onChange(randomPantryAvatar(value))}
          >
            <DicesIcon />
            Shuffle
          </Button>
        </div>

        <Group label="Shape">
          <div role="radiogroup" aria-label="Shape" className="grid grid-cols-6 gap-0.5">
            {PANTRY_SHAPE_NAMES.map((shape) => (
              <button
                key={shape}
                type="button"
                role="radio"
                aria-checked={shape === value.shape}
                aria-label={PANTRY_SHAPES[shape].name}
                title={PANTRY_SHAPES[shape].name}
                onClick={() => set({ shape })}
                className={cn(option, "size-12")}
              >
                <PantryAvatar seed={seed} {...value} shape={shape} size="lg" />
              </button>
            ))}
          </div>
        </Group>

        <Group label="Colour">
          <div role="radiogroup" aria-label="Colour" className="grid grid-cols-10 gap-0.5">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={color === value.color}
                aria-label={color[0]!.toUpperCase() + color.slice(1)}
                title={color[0]!.toUpperCase() + color.slice(1)}
                onClick={() => set({ color })}
                className={cn(option, "size-7 aria-checked:bg-transparent")}
              >
                <span
                  className="flex size-4.5 items-center justify-center rounded-full"
                  style={{ background: labelColorVar(color) }}
                >
                  {color === value.color && (
                    <CheckIcon className="size-3 text-white" strokeWidth={3} aria-hidden />
                  )}
                </span>
              </button>
            ))}
          </div>
        </Group>

        <Group label="Eyes">
          <div role="radiogroup" aria-label="Eyes" className="grid grid-cols-8 gap-0.5">
            {PANTRY_EXPRESSION_NAMES.map((expression) => (
              <button
                key={expression}
                type="button"
                role="radio"
                aria-checked={expression === value.expression}
                aria-label={AVATAR_EXPRESSIONS[expression].name}
                title={AVATAR_EXPRESSIONS[expression].name}
                onClick={() => set({ expression })}
                className={cn(option, "size-9")}
              >
                <PantryAvatar seed={seed} {...value} expression={expression} size="lg" />
              </button>
            ))}
          </div>
        </Group>
      </PopoverContent>
    </Popover>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </div>
  );
}

export { PantryAvatarPicker };
