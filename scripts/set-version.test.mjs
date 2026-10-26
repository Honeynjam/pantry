// Tests for set-version.mjs. Run with: node --test "scripts/*.test.mjs"
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkVersion, isSemver, readVersions, setVersion, targets } from "./set-version.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

let root;

// A copy of every real version file, so the tests exercise the patterns against the files as they are today.
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "pantry-set-version-"));
  for (const { path } of targets(repoRoot)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    cpSync(join(repoRoot, path), join(root, path));
  }
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const read = (path) => readFileSync(join(root, path), "utf8");

describe("set-version", () => {
  test("every version source in the repo agrees", () => {
    const versions = new Set(readVersions(repoRoot).map((entry) => entry.version));
    assert.equal(versions.size, 1, `version sources disagree: ${[...versions].join(", ")}`);
  });

  test("covers the root, every workspace package, the Mac app and the server", () => {
    const paths = targets(repoRoot).map((t) => t.path);
    for (const path of [
      "package.json",
      "apps/web/package.json",
      "apps/desktop/package.json",
      "packages/backend/package.json",
      "packages/ui/package.json",
      "apps/desktop/src-tauri/tauri.conf.json",
      "apps/desktop/src-tauri/Cargo.toml",
      "packages/backend/convex/lib/version.ts",
    ]) {
      assert.ok(paths.includes(path), `${path} is not updated`);
    }
  });

  test("writes the version everywhere and nothing else", () => {
    const before = Object.fromEntries(targets(root).map(({ path }) => [path, read(path)]));
    setVersion(root, "1.2.3-beta.1");

    for (const { version } of readVersions(root)) assert.equal(version, "1.2.3-beta.1");
    checkVersion(root, "1.2.3-beta.1");

    // Only the one version string changed in each file.
    for (const [path, text] of Object.entries(before)) {
      const after = read(path);
      const old = readVersions(repoRoot).find((entry) => entry.path === path).version;
      assert.equal(after.length - text.length, "1.2.3-beta.1".length - old.length, path);
    }
    // Dependency versions and MIN_APP_VERSION are untouched.
    assert.match(read("apps/desktop/src-tauri/Cargo.toml"), /^tauri = \{ version = "2"/m);
    assert.match(read("packages/backend/convex/lib/version.ts"), /MIN_APP_VERSION = "0\.1\.0"/);
  });

  test("rejects versions that aren't semver", () => {
    for (const bad of ["", "1.2", "v1.2.3", "01.2.3", "1.2.3.4", "1.2.3-", "latest"]) {
      assert.equal(isSemver(bad), false, bad);
      assert.throws(() => setVersion(root, bad), /Not a semver version/);
    }
    for (const good of ["0.1.0", "10.20.30", "1.0.0-rc.1", "1.0.0+build.5"]) {
      assert.equal(isSemver(good), true, good);
    }
  });

  test("fails without writing anything when a pattern doesn't match", () => {
    writeFileSync(
      join(root, "packages/backend/convex/lib/version.ts"),
      "export const VERSION = 1;\n",
    );
    const rootBefore = read("package.json");
    assert.throws(
      () => setVersion(root, "9.9.9"),
      /packages\/backend\/convex\/lib\/version\.ts: no version/,
    );
    assert.equal(read("package.json"), rootBefore);
  });

  test("fails when a file is missing", () => {
    rmSync(join(root, "apps/desktop/src-tauri/tauri.conf.json"));
    assert.throws(() => setVersion(root, "9.9.9"), /tauri\.conf\.json: file not found/);
  });

  test("--check reports the files that disagree", () => {
    setVersion(root, "2.0.0");
    const file = join(root, "apps/web/package.json");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace('"version": "2.0.0"', '"version": "1.9.9"'),
    );
    assert.throws(() => checkVersion(root, "2.0.0"), /apps\/web\/package\.json: 1\.9\.9/);
  });
});
