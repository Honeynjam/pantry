/**
 * Pantry avatars: pantry items cut from thick felt card, with a pair of eyes, for projects and
 * workspaces.
 *
 * Plain data on a 32×32 grid so the React component and any static renderer draw the same thing.
 * A shape is one silhouette (`d`, even-odd, so holes show the edge behind them) drawn twice: a dark
 * edge layer offset down-right, then the face layer on top. `creases` are faint pressed lines in
 * the edge colour. Eyes come from a separate set of expressions, so shape, colour and expression
 * combine freely.
 */

import { LABEL_COLORS, type LabelColor } from "./issue-meta";

export type AvatarShape = {
  name: string;
  d: string;
  creases?: string;
  /** Crease stroke width; wide round caps turn short creases into dots (cookie chips). */
  creaseWidth?: number;
  /** Where the eyes sit (the point between them) and how big they are. */
  face: { x: number; y: number; scale?: number };
};

export type EyeMark =
  | { el: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { el: "circle"; cx: number; cy: number; r: number }
  | { el: "line"; d: string };

export type AvatarExpression = {
  name: string;
  eyes: EyeMark[];
  brows?: string;
  /** Closed or squinting eyes don't blink. */
  blinks: boolean;
};

export const PANTRY_SHAPES = {
  toast: {
    name: "Toast",
    d: "M6 27.5V13.6C3.8 12.7 3 11 3 9.2 3 5.8 6.2 3.5 10.2 3.5h11.6c4 0 7.2 2.3 7.2 5.7 0 1.8-.8 3.5-3 4.4v13.9c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2z",
    creases:
      "M8.4 26.6V12.1C6.3 11.5 5.4 10.4 5.4 9.2c0-2 2.1-3.4 4.8-3.4h11.6c2.7 0 4.8 1.4 4.8 3.4 0 1.2-.9 2.3-3 2.9v14.5z",
    face: { x: 15.4, y: 16.5 },
  },
  loaf: {
    name: "Loaf",
    d: "M3.5 26v-7c0-3.4 1.4-6 3.8-7.3C8.4 9.2 10.4 8 12.4 8.5c1.3-1.8 3.2-2.4 5-1.7 1.9-.6 3.8.5 4.6 2.5 2.3-.3 4.4 1.3 5.1 3.7 1.1 1.6 1.4 3.6 1.4 6v7c0 1.4-1.1 2.5-2.5 2.5H6C4.6 28.5 3.5 27.4 3.5 26z",
    creases: "M9.6 12.4l1.4-1.7M14.8 10.6l1.4-1.7M20 11.8l1.4-1.7",
    face: { x: 15.4, y: 19.5 },
  },
  jam: {
    name: "Jam jar",
    d: "M9.7 3.5h12.6c.7 0 1.2.5 1.2 1.2V7c0 .6-.4 1-.9 1.1v1.3c2.4.4 3.9 2.2 3.9 5.1v10c0 2.5-2 4.5-4.5 4.5H10c-2.5 0-4.5-2-4.5-4.5v-10c0-2.9 1.5-4.7 3.9-5.1V8.1c-.5-.1-.9-.5-.9-1.1V4.7c0-.7.5-1.2 1.2-1.2z",
    creases: "M9.4 9.4h13.2",
    face: { x: 15.4, y: 19 },
  },
  honey: {
    name: "Honey pot",
    d: "M9 5.5h14c1.1 0 2 .9 2 2 0 .9-.6 1.6-1.4 1.9 2.6 1.6 3.9 4.6 3.9 9.1 0 6.5-4.5 10.5-11.5 10.5S4.5 25 4.5 18.5c0-4.5 1.3-7.5 3.9-9.1C7.6 9.1 7 8.4 7 7.5c0-1.1.9-2 2-2z",
    creases:
      "M7.4 11.6c1.6.4 1.9 3 3 3s1.3-2.2 2.6-2.2 1.6 3.9 3.1 3.9 1.6-3.6 3-3.6 1.4 1.6 2.5 1.6 1.4-2 2.9-2.7",
    face: { x: 15.4, y: 20 },
  },
  egg: {
    name: "Egg",
    d: "M16 3c5.8 0 11 8.6 11 16 0 6.4-4.9 10.5-11 10.5S5 25.4 5 19C5 11.6 10.2 3 16 3z",
    face: { x: 15.4, y: 18.5 },
  },
  cookie: {
    name: "Cookie",
    d: "M27.04 10.63A12.5 12.5 0 1 1 19.86 4.61a3.4 3.4 0 0 0 1.93 5 3.4 3.4 0 0 0 5.25 1.02z",
    creases: "M9.6 10.4h.01M7.4 19h.01M12.4 25.4h.01M21.2 24.6h.01M25 19.4h.01",
    creaseWidth: 2,
    face: { x: 14.6, y: 17.5 },
  },
  cheese: {
    name: "Cheese",
    d: "M4 15 22 5.5c1-.5 2.2-.3 2.8.6L28 11v15.5c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2zM24.3 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3zM8.2 22.6a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 1 0 0-3.4zM24.6 23.4a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 1 0 0-2.2z",
    creases: "M4.6 15 27.4 11",
    face: { x: 15, y: 20.5 },
  },
  milk: {
    name: "Milk carton",
    d: "M8 12.5 11.6 6.2H14V4c0-.6.4-1 1-1h2c.6 0 1 .4 1 1v2.2h2.4L24 12.5V28c0 .8-.7 1.5-1.5 1.5h-13C8.7 29.5 8 28.8 8 28z",
    creases: "M8.6 12.5h14.8",
    face: { x: 15.6, y: 20.5 },
  },
  muffin: {
    name: "Muffin",
    d: "M5.8 19c-.9-.2-1.3-.8-1.3-1.6 0-6.5 5.1-10.9 11.5-10.9s11.5 4.4 11.5 10.9c0 .8-.4 1.4-1.3 1.6l-2.6 8.7c-.2.8-.9 1.3-1.7 1.3H10.1c-.8 0-1.5-.5-1.7-1.3z",
    creases: "M6.6 19h18.8M12.2 21.4l.6 5.4M16 21.4v5.4M19.8 21.4l-.6 5.4",
    face: { x: 15.4, y: 13.4, scale: 0.9 },
  },
  sack: {
    name: "Flour sack",
    d: "M10.6 9.6C8.2 12.8 5 16.8 5 22.2c0 5.2 3 7.3 11 7.3s11-2.1 11-7.3c0-5.4-3.2-9.4-5.6-12.6.6-.3.9-.8.7-1.4 1.4-2-.1-4.8-2.7-4-1.2-1.6-5.6-1.6-6.8 0-2.6-.8-4.1 2-2.7 4-.2.6.1 1.1.7 1.4z",
    creases: "M11 9.1h10",
    face: { x: 15.4, y: 20 },
  },
  bottle: {
    name: "Bottle",
    d: "M13.5 3h5c.5 0 .8.4.8.8v1.7c0 .4-.3.7-.7.8v3.9c3.8 1.4 5.9 4.2 5.9 7.8v9c0 1.4-1.1 2.5-2.5 2.5H10c-1.4 0-2.5-1.1-2.5-2.5v-9c0-3.6 2.1-6.4 5.9-7.8V6.3c-.4-.1-.7-.4-.7-.8V3.8c0-.4.3-.8.8-.8z",
    creases: "M13.4 6.3h5.2",
    face: { x: 15.4, y: 20 },
  },
} satisfies Record<string, AvatarShape>;

export type PantryShape = keyof typeof PANTRY_SHAPES;
export const PANTRY_SHAPE_NAMES = Object.keys(PANTRY_SHAPES) as PantryShape[];

/** Eyes, centred on the face point. Drawn in ink; brows are thinner and softer. */
export const AVATAR_EXPRESSIONS = {
  curious: {
    name: "Curious",
    eyes: [
      { el: "ellipse", cx: -3, cy: 0, rx: 1.45, ry: 2.3 },
      { el: "circle", cx: 3, cy: 0.4, r: 1.75 },
    ],
    brows: "M-4.6-3.6q1.6-.8 3.2-.2M1.4-3.9q1.8-.8 3.5.2",
    blinks: true,
  },
  dots: {
    name: "Dots",
    eyes: [
      { el: "circle", cx: -2.9, cy: 0, r: 1.6 },
      { el: "circle", cx: 2.9, cy: 0, r: 1.6 },
    ],
    brows: "M-4.3-3.1q1.4-.6 2.8 0M1.5-3.1q1.4-.6 2.8 0",
    blinks: true,
  },
  tall: {
    name: "Tall",
    eyes: [
      { el: "ellipse", cx: -2.8, cy: 0, rx: 1.3, ry: 2.4 },
      { el: "ellipse", cx: 2.8, cy: 0, rx: 1.3, ry: 2.4 },
    ],
    blinks: true,
  },
  happy: {
    name: "Happy",
    eyes: [
      { el: "line", d: "M-4.5.9q1.5-2.6 3 0" },
      { el: "line", d: "M1.5.9q1.5-2.6 3 0" },
    ],
    brows: "M-4.6-2.9q1.6-.7 3.2 0M1.4-2.9q1.6-.7 3.2 0",
    blinks: false,
  },
  sleepy: {
    name: "Sleepy",
    eyes: [
      { el: "line", d: "M-4.3.3h2.6" },
      { el: "line", d: "M1.7.3h2.6" },
    ],
    blinks: false,
  },
  grumpy: {
    name: "Grumpy",
    eyes: [
      { el: "circle", cx: -2.9, cy: 0.5, r: 1.5 },
      { el: "circle", cx: 2.9, cy: 0.5, r: 1.5 },
    ],
    brows: "M-4.7-2.4l3 1M1.7-1.4l3-1",
    blinks: true,
  },
  wink: {
    name: "Wink",
    eyes: [
      { el: "line", d: "M-4.3.4h2.6" },
      { el: "circle", cx: 3, cy: 0, r: 1.75 },
    ],
    brows: "M1.3-3.7q1.8-.8 3.5.2",
    blinks: false,
  },
  surprised: {
    name: "Surprised",
    eyes: [
      { el: "ellipse", cx: -2.9, cy: 0.3, rx: 1.5, ry: 2.5 },
      { el: "ellipse", cx: 2.9, cy: 0.3, rx: 1.5, ry: 2.5 },
    ],
    brows: "M-4.5-4.4q1.5-.9 3 0M1.5-4.4q1.5-.9 3 0",
    blinks: true,
  },
} satisfies Record<string, AvatarExpression>;

export type PantryExpression = keyof typeof AVATAR_EXPRESSIONS;
export const PANTRY_EXPRESSION_NAMES = Object.keys(AVATAR_EXPRESSIONS) as PantryExpression[];

/** Colours an avatar can take: the label palette without grey. */
export const AVATAR_COLORS = LABEL_COLORS.filter((color) => color !== "gray") as Exclude<
  LabelColor,
  "gray"
>[];
export type AvatarColor = (typeof AVATAR_COLORS)[number];

/** How far the edge layer sits behind the face layer, in grid units. */
export const AVATAR_DEPTH = { x: 1.4, y: 1.7 };

function hash(seed: string): number {
  let value = 0;
  for (const char of seed) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

/**
 * A stable look for a seed (a project key, a workspace slug). The colour uses the same hash the
 * old sidebar dot did, so each project keeps the colour it always had.
 */
export function pickPantryAvatar(seed: string): {
  shape: PantryShape;
  color: AvatarColor;
  expression: PantryExpression;
  tilt: number;
  blink: { duration: number; delay: number };
} {
  const value = hash(seed);
  const shape = hash(`${seed}·shape`);
  const face = hash(`${seed}·face`);
  return {
    shape: PANTRY_SHAPE_NAMES[shape % PANTRY_SHAPE_NAMES.length]!,
    color: AVATAR_COLORS[value % AVATAR_COLORS.length]!,
    expression: PANTRY_EXPRESSION_NAMES[face % PANTRY_EXPRESSION_NAMES.length]!,
    // A slight lean, like a cutout set down by hand.
    tilt: [-6, -3, 0, 3, 6][(face >>> 4) % 5]!,
    // Each avatar blinks on its own clock so a list of them never blinks in unison.
    blink: { duration: 4.5 + (shape % 7) * 0.5, delay: -((value % 50) / 10) },
  };
}

/** How each tone is mixed from the avatar's hue. `hue` is any CSS colour, usually var(--label-*). */
export function avatarTones(hue: string): Record<"face" | "edge" | "ink", string> {
  return {
    face: `color-mix(in oklch, ${hue} 62%, white)`,
    edge: `color-mix(in oklch, ${hue} 82%, black)`,
    ink: `color-mix(in oklch, ${hue} 8%, oklch(0.17 0 0))`,
  };
}

/** The part of an avatar a person chooses; tilt and blink timing always come from the seed. */
export type PantryAvatarValue = {
  shape: PantryShape;
  color: AvatarColor;
  expression: PantryExpression;
};

const pickOne = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!;

/** A random avatar, e.g. the starting look of a new project. Pass `not` to avoid repeating it. */
export function randomPantryAvatar(not?: PantryAvatarValue): PantryAvatarValue {
  const next = {
    shape: pickOne(PANTRY_SHAPE_NAMES),
    color: pickOne(AVATAR_COLORS),
    expression: pickOne(PANTRY_EXPRESSION_NAMES),
  };
  return not && next.shape === not.shape && next.color === not.color
    ? randomPantryAvatar(not)
    : next;
}
