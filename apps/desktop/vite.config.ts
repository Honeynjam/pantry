import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Which Pantry server the spike talks to, fixed at build time (the M5 app asks for a server URL at
 * first launch instead, spec §10). In order:
 *   1. PANTRY_SERVER_URL=https://<app>.vercel.app → read its GET /api/instance
 *   2. VITE_CONVEX_URL (+ optional VITE_CONVEX_SITE_URL)
 *   3. the local backend that `convex dev` wrote to packages/backend/.env.local
 */
type Server = { convexUrl: string; convexSiteUrl: string; source: string };

async function resolveServer(): Promise<Server | null> {
  const serverUrl = process.env.PANTRY_SERVER_URL?.replace(/\/+$/, "");
  if (serverUrl) {
    const response = await fetch(`${serverUrl}/api/instance`);
    if (!response.ok) throw new Error(`${serverUrl}/api/instance answered ${response.status}: not a Pantry server?`);
    const info = (await response.json()) as { convexUrl: string; convexSiteUrl: string };
    return { convexUrl: info.convexUrl, convexSiteUrl: info.convexSiteUrl, source: serverUrl };
  }
  const env = process.env.VITE_CONVEX_URL ? process.env : localConvexEnv();
  const convexUrl = env.VITE_CONVEX_URL ?? env.CONVEX_URL;
  if (!convexUrl) return null;
  const convexSiteUrl =
    env.VITE_CONVEX_SITE_URL ?? env.CONVEX_SITE_URL ?? convexUrl.replace(/\.convex\.cloud\/?$/, ".convex.site");
  return { convexUrl, convexSiteUrl, source: convexUrl };
}

function localConvexEnv(): Record<string, string | undefined> {
  try {
    const file = fileURLToPath(new URL("../../packages/backend/.env.local", import.meta.url));
    return Object.fromEntries(
      readFileSync(file, "utf8")
        .split("\n")
        .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
        .filter((match): match is RegExpMatchArray => match !== null)
        .map((match) => [match[1]!, match[2]!.replace(/^["']|["']$/g, "")]),
    );
  } catch {
    return {};
  }
}

export default defineConfig(async () => {
  const server = await resolveServer();
  return {
    plugins: [react(), tailwindcss()],
    define: { __PANTRY_SERVER__: JSON.stringify(server) },
    // Tauri expects a fixed port and shouldn't have its Rust output watched.
    clearScreen: false,
    server: { watch: { ignored: ["**/src-tauri/**"] } },
    // One bundle loaded from disk by the webview, so chunk size doesn't matter here.
    build: { target: "safari16", outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  };
});
