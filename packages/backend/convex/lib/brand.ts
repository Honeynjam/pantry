/**
 * The only place the product name, default issue key and token prefix live.
 * Everything else (app, MCP tool descriptions, /api/instance, seed data) imports them.
 */
export const brand = {
  name: "Pantry",
  defaultKey: "PAN",
  tokenPrefix: "pan_",
} as const;

export type Brand = typeof brand;
