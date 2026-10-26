import * as React from "react";
import {
  AVATAR_DEPTH,
  AVATAR_EXPRESSIONS,
  PANTRY_SHAPES,
  avatarTones,
  pickPantryAvatar,
  type AvatarColor,
  type AvatarExpression,
  type AvatarShape,
  type PantryExpression,
  type PantryShape,
} from "@pantry/ui/lib/pantry-avatars";
import { labelColorVar } from "@pantry/ui/lib/issue-meta";
import { cn } from "@pantry/ui/lib/utils";

type PantryAvatarSize = "xs" | "sm" | "default" | "lg" | "xl";

const SIZES: Record<PantryAvatarSize, string> = {
  xs: "size-4",
  sm: "size-5",
  default: "size-6",
  lg: "size-8",
  xl: "size-12",
};

/**
 * A pantry item cut from thick felt card, with eyes, for a space. The seed (a
 * space key) picks a stable shape, colour and expression; `shape`, `color` and
 * `expression` override them. xs 16 / sm 20 / default 24 / lg 32 / xl 48. Decorative: pair it
 * with the name it stands for.
 */
function PantryAvatar({
  seed,
  shape,
  color,
  expression,
  size = "default",
  className,
  ...props
}: Omit<React.ComponentProps<"svg">, "color"> & {
  seed: string;
  shape?: PantryShape;
  color?: AvatarColor;
  expression?: PantryExpression;
  size?: PantryAvatarSize;
}) {
  const grainId = `pantry-avatar-${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const picked = pickPantryAvatar(seed);
  const shapeName = shape ?? picked.shape;
  const cutout: AvatarShape = PANTRY_SHAPES[shapeName];
  const eyes: AvatarExpression = AVATAR_EXPRESSIONS[expression ?? picked.expression];
  const tones = avatarTones(labelColorVar(color ?? picked.color));
  const { x, y, scale = 1 } = cutout.face;
  const faceScale = scale * 1.15;

  return (
    <svg
      data-slot="pantry-avatar"
      data-shape={shapeName}
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("shrink-0 overflow-visible select-none", SIZES[size], className)}
      {...props}
    >
      <defs>
        {/* Felt grain: dark and light speckles from one noise field, kept inside the cutout. */}
        <filter id={grainId} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="3.2" numOctaves="2" seed="4" result="noise" />
          <feColorMatrix in="noise" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 -0.32" result="dark" />
          <feColorMatrix in="noise" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -0.7 0.3" result="light" />
          <feMerge result="speckle">
            <feMergeNode in="dark" />
            <feMergeNode in="light" />
          </feMerge>
          <feComposite in="speckle" in2="SourceGraphic" operator="in" result="grain" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="grain" />
          </feMerge>
        </filter>
      </defs>
      <g transform={`rotate(${picked.tilt} 16 16)`}>
        <g filter={`url(#${grainId})`}>
          <path
            d={cutout.d}
            fill={tones.edge}
            fillRule="evenodd"
            transform={`translate(${AVATAR_DEPTH.x} ${AVATAR_DEPTH.y})`}
          />
          <path d={cutout.d} fill={tones.face} fillRule="evenodd" />
          {cutout.creases && (
            <path
              d={cutout.creases}
              fill="none"
              stroke={tones.edge}
              strokeWidth={cutout.creaseWidth ?? 0.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.3}
            />
          )}
        </g>
        <g transform={`translate(${x} ${y}) scale(${faceScale})`}>
          {eyes.brows && (
            <path
              d={eyes.brows}
              fill="none"
              stroke={tones.ink}
              strokeWidth={0.75}
              strokeLinecap="round"
              opacity={0.7}
            />
          )}
          <g
            className={eyes.blinks ? "pantry-avatar-eyes" : undefined}
            style={
              eyes.blinks
                ? { animationDuration: `${picked.blink.duration}s`, animationDelay: `${picked.blink.delay}s` }
                : undefined
            }
          >
            {eyes.eyes.map((mark, index) =>
              mark.el === "line" ? (
                <path key={index} d={mark.d} fill="none" stroke={tones.ink} strokeWidth={1.2} strokeLinecap="round" />
              ) : mark.el === "circle" ? (
                <circle key={index} cx={mark.cx} cy={mark.cy} r={mark.r} fill={tones.ink} />
              ) : (
                <ellipse key={index} cx={mark.cx} cy={mark.cy} rx={mark.rx} ry={mark.ry} fill={tones.ink} />
              ),
            )}
          </g>
        </g>
      </g>
    </svg>
  );
}

export { PantryAvatar };
