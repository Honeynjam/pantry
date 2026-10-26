#!/usr/bin/env node
// Sets Pantry's version everywhere it is written down, so a release can't ship with one file still on the old
// number: the root package.json, every apps/* and packages/* package.json, the Mac app's tauri.conf.json,
// Cargo.toml and Cargo.lock, and SERVER_VERSION in packages/backend/convex/lib/version.ts (what /api/instance
// reports). MIN_APP_VERSION is left alone: raise it by hand when a server change needs a newer Mac app.
//
//   pnpm set-version 0.2.0            write the version to every file
//   pnpm set-version --check 0.2.0    change nothing; fail unless every file already says 0.2.0
//
// Every pattern must match. If one doesn't (a file moved or changed shape), nothing is written and the script
// fails, so update the list below rather than working around it.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// semver.org's recommended pattern (2.0.0), without the leading "v".
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export function isSemver(version) {
  return typeof version === "string" && SEMVER.test(version);
}

// Each pattern captures (prefix)(version)(suffix); only the first match in the file is touched. In every
// package.json "version" is the key right after "name".
const PACKAGE_JSON = /^(\{\s*"name": "[^"]+",\s*"version": ")([^"]*)(")/;

/** The files and patterns that carry Pantry's version, relative to the repo root. */
export function targets(root) {
  const workspacePackages = ["apps", "packages"].flatMap((dir) =>
    existsSync(join(root, dir))
      ? readdirSync(join(root, dir), { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => `${dir}/${entry.name}/package.json`)
          .filter((path) => existsSync(join(root, path)))
          .sort()
      : [],
  );
  return [
    { path: "package.json", pattern: PACKAGE_JSON },
    ...workspacePackages.map((path) => ({ path, pattern: PACKAGE_JSON })),
    { path: "apps/desktop/src-tauri/tauri.conf.json", pattern: /^(\s{2}"version": ")([^"]*)(")/m },
    {
      path: "apps/desktop/src-tauri/Cargo.toml",
      pattern: /^(\[package\]\n(?:(?!\[)[^\n]*\n)*?version = ")([^"]*)(")/m,
    },
    {
      path: "apps/desktop/src-tauri/Cargo.lock",
      pattern: /^(name = "pantry-desktop"\nversion = ")([^"]*)(")/m,
    },
    {
      path: "packages/backend/convex/lib/version.ts",
      pattern: /^(export const SERVER_VERSION = ")([^"]*)(";)/m,
    },
  ];
}

function load(root) {
  const failures = [];
  const files = targets(root).map(({ path, pattern }) => {
    const file = join(root, path);
    const text = existsSync(file) ? readFileSync(file, "utf8") : null;
    const match = text === null ? null : pattern.exec(text);
    if (!match)
      failures.push(text === null ? `${path}: file not found` : `${path}: no version found`);
    return { path, file, text, pattern, current: match?.[2] };
  });
  if (failures.length > 0) {
    throw new Error(`Can't find the version in:\n  ${failures.join("\n  ")}`);
  }
  return files;
}

/** Returns [{ path, version }] for every file that carries the version. Throws if any pattern misses. */
export function readVersions(root) {
  return load(root).map(({ path, current }) => ({ path, version: current }));
}

/** Writes `version` to every target. Validates everything first, so a failure writes nothing. */
export function setVersion(root, version) {
  if (!isSemver(version)) throw new Error(`Not a semver version: ${JSON.stringify(version)}`);
  const files = load(root);
  for (const { file, text, pattern } of files) {
    writeFileSync(
      file,
      text.replace(pattern, (_, prefix, _old, suffix) => prefix + version + suffix),
    );
  }
  return files.map(({ path, current }) => ({ path, from: current, to: version }));
}

/** Throws unless every target already carries `version`. */
export function checkVersion(root, version) {
  if (!isSemver(version)) throw new Error(`Not a semver version: ${JSON.stringify(version)}`);
  const wrong = readVersions(root).filter((entry) => entry.version !== version);
  if (wrong.length > 0) {
    throw new Error(
      `Expected ${version} in every file, but:\n  ${wrong.map((w) => `${w.path}: ${w.version}`).join("\n  ")}`,
    );
  }
}

function main(argv) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const check = argv[0] === "--check";
  const version = check ? argv[1] : argv[0];
  if (!version || argv.length > (check ? 2 : 1)) {
    console.error("usage: pnpm set-version 0.2.0\n       pnpm set-version --check 0.2.0");
    process.exit(1);
  }
  try {
    if (check) {
      checkVersion(root, version);
      console.log(`Every version source says ${version}.`);
    } else {
      for (const { path, from, to } of setVersion(root, version)) {
        console.log(`${path}: ${from} → ${to}`);
      }
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
