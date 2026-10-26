#!/usr/bin/env node
// Prints one version's section of CHANGELOG.md, for the GitHub Release (see .github/workflows/release.yml).
//
//   node scripts/release-notes.mjs 0.2.0 > notes.md
//
// Fails unless the changelog has a "## [0.2.0] - YYYY-MM-DD" heading with something under it, so a release can't
// go out with an undated or empty section.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Returns the body of `version`'s section in `changelog` (Keep a Changelog format), without HTML comments. */
export function releaseNotes(changelog, version) {
  const lines = changelog.split("\n");
  const heading = new RegExp(`^## \\[${escape(version)}\\]`);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) throw new Error(`CHANGELOG.md has no "## [${version}]" section.`);
  if (!new RegExp(`^## \\[${escape(version)}\\] - \\d{4}-\\d{2}-\\d{2}\\s*$`).test(lines[start])) {
    throw new Error(
      `CHANGELOG.md: the ${version} heading needs a release date, like "## [${version}] - 2026-01-31". ` +
        `It says: ${lines[start]}`,
    );
  }
  // The section ends at the next version heading or at the link definitions at the bottom of the file.
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^## \[/.test(line) || /^\[[^\]]+\]: /.test(line));
  const body = (end === -1 ? rest : rest.slice(0, end))
    .join("\n")
    .replace(/<!--[\s\S]*?-->\n?/g, "")
    .trim();
  if (!body) throw new Error(`CHANGELOG.md: the ${version} section is empty.`);
  return body + "\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = process.argv[2];
  if (!version || process.argv.length > 3) {
    console.error("usage: node scripts/release-notes.mjs 0.2.0");
    process.exit(1);
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  try {
    process.stdout.write(releaseNotes(readFileSync(join(root, "CHANGELOG.md"), "utf8"), version));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
