"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { PantryAvatar } from "@pantry/ui/components/pantry-avatar";
import { spring, useMotionTransition } from "@pantry/ui/lib/motion";
import { PANTRY_SHAPE_NAMES, type PantryShape } from "@pantry/ui/lib/pantry-avatars";
import { cn } from "@pantry/ui/lib/utils";
import { BRAND_AVATAR } from "@/lib/brand-avatar";
import { brandName } from "@/lib/content";

/** Everyone else in the pantry, in the order they take the jar's place on hover. */
const FRIENDS = PANTRY_SHAPE_NAMES.filter((shape) => shape !== BRAND_AVATAR.shape);
const SWAP_MS = 420;

export function PantryMark({ className }: { className?: string }) {
  return <PantryAvatar {...BRAND_AVATAR} className={cn("size-[1.35em]", className)} />;
}

/**
 * Logo + wordmark. With `playful`, hovering (or focusing) it makes the jar's pantry friends take
 * turns in its place; it settles back to the jar when you leave. Reduced motion: they swap with a
 * short fade instead of popping.
 */
export function PantryLogo({
  className,
  playful = false,
}: {
  className?: string;
  playful?: boolean;
}) {
  const [friend, setFriend] = React.useState<number | null>(null);
  const timer = React.useRef<number | undefined>(undefined);
  const pop = useMotionTransition(spring.snappy);

  const start = () => {
    if (!playful || timer.current) return;
    setFriend(0);
    timer.current = window.setInterval(
      () => setFriend((index) => ((index ?? -1) + 1) % FRIENDS.length),
      SWAP_MS,
    );
  };
  const stop = () => {
    window.clearInterval(timer.current);
    timer.current = undefined;
    setFriend(null);
  };
  React.useEffect(() => () => window.clearInterval(timer.current), []);

  const shape: PantryShape = friend === null ? BRAND_AVATAR.shape : FRIENDS[friend]!;

  return (
    <span
      onPointerEnter={start}
      onPointerLeave={stop}
      onFocus={start}
      onBlur={stop}
      className={cn(
        "font-display inline-flex items-center gap-2 font-semibold tracking-[-0.02em]",
        className,
      )}
    >
      <span className="relative inline-flex size-[1.35em] items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={shape}
            initial={{ opacity: 0, scale: 0.6, rotate: -14 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6, rotate: 14 }}
            transition={pop}
            className="absolute inset-0 flex"
          >
            {shape === BRAND_AVATAR.shape ? (
              <PantryAvatar {...BRAND_AVATAR} className="size-full" />
            ) : (
              <PantryAvatar seed={shape} shape={shape} className="size-full" />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      {brandName}
    </span>
  );
}

/** The Mac app icon: the jar on a dark squircle. */
export function PantryAppIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[24%] bg-[linear-gradient(180deg,oklch(0.3_0_0),oklch(0.16_0_0))] shadow-[inset_0_0_0_1px_oklch(1_0_0/0.12)]",
        className,
      )}
    >
      <PantryAvatar {...BRAND_AVATAR} className="size-[70%]" />
    </span>
  );
}
