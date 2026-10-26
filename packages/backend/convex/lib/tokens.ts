/**
 * Secrets (spec §10b): random 32 bytes, base64url, with a prefix. Generate them in actions only
 * (queries and mutations are deterministic); store only the SHA-256 hash.
 */

export const INVITE_TOKEN_PREFIX = "inv_";

/** `prefix` + 32 random bytes as base64url. Call from an action. */
export function randomToken(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64url = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${prefix}${base64url}`;
}

/** SHA-256 of a token as lower-case hex. Deterministic, so safe in queries and mutations. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
