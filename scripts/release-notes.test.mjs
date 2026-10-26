// Tests for release-notes.mjs. Run with: node --test "scripts/*.test.mjs"
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { releaseNotes } from "./release-notes.mjs";

const changelog = `# Changelog

## [Unreleased]

- Not out yet.

## [1.1.0] - 2026-11-02

<!-- a note for the maintainer -->

### Fixed

- The board scrolls.

## [1.0.0] - 2026-10-30

### Added

- Everything.

[Unreleased]: https://github.com/honeynjam/pantry/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/honeynjam/pantry/releases/tag/v1.1.0
`;

describe("release-notes", () => {
  test("returns one version's section without comments or link definitions", () => {
    assert.equal(releaseNotes(changelog, "1.1.0"), "### Fixed\n\n- The board scrolls.\n");
    assert.equal(releaseNotes(changelog, "1.0.0"), "### Added\n\n- Everything.\n");
  });

  test("fails for a missing version", () => {
    assert.throws(() => releaseNotes(changelog, "2.0.0"), /no "## \[2\.0\.0\]" section/);
  });

  test("fails for a section without a date", () => {
    const undated = changelog.replace("## [1.1.0] - 2026-11-02", "## [1.1.0] - Unreleased");
    assert.throws(() => releaseNotes(undated, "1.1.0"), /needs a release date/);
  });

  test("fails for an empty section", () => {
    const empty =
      "## [1.0.0] - 2026-10-30\n\n<!-- nothing yet -->\n\n## [0.9.0] - 2026-10-01\n\n- Old.\n";
    assert.throws(() => releaseNotes(empty, "1.0.0"), /section is empty/);
  });

  test("treats dots in the version literally", () => {
    assert.throws(() => releaseNotes(changelog, "1x1x0"), /no "## \[1x1x0\]" section/);
  });

  test("the real changelog's 0.1.0 section can be extracted once it's dated", () => {
    const real = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../CHANGELOG.md"),
      "utf8",
    );
    const dated = real.replace(/^## \[0\.1\.0\] - Unreleased$/m, "## [0.1.0] - 2026-10-26");
    const notes = releaseNotes(dated, "0.1.0");
    assert.match(notes, /^### Added$/m);
    assert.doesNotMatch(notes, /TODO|\[Unreleased\]/);
  });
});
