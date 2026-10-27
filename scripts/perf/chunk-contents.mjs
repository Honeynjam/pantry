#!/usr/bin/env node
// What's inside a chunk, by package: bytes of generated code attributed to each source through the
// chunk's source map. Needs a build with `productionBrowserSourceMaps: true`.
// Usage: node scripts/perf/chunk-contents.mjs <chunk.js> [top=25]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const { decode } = require(
  require.resolve("@jridgewell/sourcemap-codec", {
    paths: [new URL("../../node_modules/.pnpm/node_modules", import.meta.url).pathname],
  }),
);

const [file, topArg] = process.argv.slice(2);
const top = Number(topArg ?? 25);
const code = readFileSync(file, "utf8");
const mapName = code.match(/sourceMappingURL=(\S+)\s*$/)?.[1];
const map = JSON.parse(
  readFileSync(mapName ? join(dirname(file), mapName) : `${file}.map`, "utf8"),
);
const sections = map.sections ?? [{ offset: { line: 0, column: 0 }, map }];
const lines = code.split("\n");
const bytes = new Map();

function bucket(source) {
  const path = source.replace(/^turbopack:\/\/\/?(\[project\]\/)?/, "");
  const pnpm = path.match(/node_modules\/\.pnpm\/[^/]+\/node_modules\/((@[^/]+\/)?[^/]+)/);
  if (pnpm) return pnpm[1];
  const pkg = path.match(/^(packages|apps)\/([^/]+)\/(src\/)?([^/]+)/);
  return pkg ? `${pkg[1]}/${pkg[2]}/${pkg[4]}` : path;
}

for (const section of sections) {
  const decoded = decode(section.map.mappings);
  decoded.forEach((segments, index) => {
    const lineNo = index + section.offset.line;
    const text = lines[lineNo] ?? "";
    segments.forEach((segment, i) => {
      if (segment.length < 2) return;
      const start = (index === 0 ? section.offset.column : 0) + segment[0];
      const next = segments[i + 1];
      const end = next ? (index === 0 ? section.offset.column : 0) + next[0] : text.length;
      const name = bucket(section.map.sources[segment[1]] ?? "?");
      bytes.set(name, (bytes.get(name) ?? 0) + Math.max(0, end - start));
    });
  });
}

const total = code.length;
console.log(`${file}: ${(total / 1024).toFixed(0)} kB`);
for (const [name, size] of [...bytes].sort((a, b) => b[1] - a[1]).slice(0, top)) {
  console.log(`${(size / 1024).toFixed(1).padStart(8)} kB  ${name}`);
}
