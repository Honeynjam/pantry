#!/usr/bin/env node
// First-load JS per route of a `next build` (Turbopack doesn't print it): the root main files plus
// each page's entry chunks from its client reference manifest, raw and gzipped.
// Usage: node scripts/perf/bundle-report.mjs [apps/web/.next] [--json]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const args = process.argv.slice(2);
const dist = args.find((arg) => !arg.startsWith("--")) ?? "apps/web/.next";
const asJson = args.includes("--json");

const build = JSON.parse(readFileSync(join(dist, "build-manifest.json"), "utf8"));
const sizes = new Map();
function size(file) {
  if (!sizes.has(file)) {
    const body = readFileSync(join(dist, file));
    sizes.set(file, { raw: body.length, gzip: gzipSync(body, { level: 9 }).length });
  }
  return sizes.get(file);
}

function* manifests(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* manifests(path);
    else if (name === "page_client-reference-manifest.js") yield path;
  }
}

const rows = [];
for (const file of manifests(join(dist, "server/app"))) {
  globalThis.__RSC_MANIFEST = {};
  new Function(readFileSync(file, "utf8"))();
  const [route, manifest] = Object.entries(globalThis.__RSC_MANIFEST)[0];
  if (route.startsWith("/_")) continue;
  const pageKey = Object.keys(manifest.entryJSFiles).find(
    (key) => key.endsWith(`${route}`) || key.endsWith(`${route}/page`),
  );
  const files = new Set(build.rootMainFiles);
  for (const [key, chunks] of Object.entries(manifest.entryJSFiles)) {
    // Layouts on the way to the page, and the page itself.
    if (key === pageKey || key.endsWith("/layout")) for (const chunk of chunks) files.add(chunk);
  }
  let raw = 0;
  let gzip = 0;
  for (const chunk of files) {
    const s = size(chunk);
    raw += s.raw;
    gzip += s.gzip;
  }
  rows.push({
    route: route.replace(/\/page$/, "").replace("/(app)", "") || "/",
    raw,
    gzip,
    chunks: files.size,
  });
}
rows.sort((a, b) => a.route.localeCompare(b.route));

const allJs = readdirSync(join(dist, "static/chunks")).filter((name) => name.endsWith(".js"));
const largest = allJs
  .map((name) => ({ name, ...size(join("static/chunks", name)) }))
  .sort((a, b) => b.raw - a.raw)
  .slice(0, 8);

if (asJson) {
  console.log(JSON.stringify({ routes: rows, largest }, null, 2));
} else {
  const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
  console.log(`First-load JS (${relative(process.cwd(), dist)})`);
  console.log("route".padEnd(28), "raw".padStart(9), "gzip".padStart(9), "chunks".padStart(7));
  for (const row of rows)
    console.log(
      row.route.padEnd(28),
      kb(row.raw).padStart(9),
      kb(row.gzip).padStart(9),
      String(row.chunks).padStart(7),
    );
  console.log("\nLargest chunks");
  for (const chunk of largest)
    console.log(chunk.name.padEnd(28), kb(chunk.raw).padStart(9), kb(chunk.gzip).padStart(9));
}
