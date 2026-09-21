import { describe, expect, it } from "vitest";
import {
  parseChangelogReleases,
  validateReleaseVersionConsistency
} from "../../scripts/check-release-version-consistency.mjs";

const changelog = (...versions: string[]) =>
  [
    "# Changelog",
    "",
    "## [Unreleased]",
    "",
    "Pending work.",
    "",
    ...versions.flatMap((version, index) => [
      `## [${version}] - 2026-09-${String(20 - index).padStart(2, "0")}`,
      "",
      "- Release notes.",
      ""
    ])
  ].join("\n");

describe("release version consistency guard", () => {
  it("accepts the current package, changelog, and canonical tag", () => {
    const result = validateReleaseVersionConsistency({
      packageVersion: "3.3.0",
      changelog: changelog("3.3.0", "3.2.0"),
      tags: ["v3.3.0"]
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("allows a prepared next release before its tag exists", () => {
    const result = validateReleaseVersionConsistency({
      packageVersion: "3.4.0",
      changelog: changelog("3.4.0", "3.3.0"),
      tags: ["v3.3.0"]
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(["v3.4.0 is not tagged yet; this is valid only while preparing the next release"]);
  });

  it("rejects package and changelog version drift", () => {
    const result = validateReleaseVersionConsistency({
      packageVersion: "3.4.0",
      changelog: changelog("3.3.0"),
      tags: ["v3.3.0"]
    });

    expect(result.errors).toContain("package.json version 3.4.0 must match the newest CHANGELOG.md release 3.3.0");
  });

  it("rejects a release tag that does not match package metadata", () => {
    const result = validateReleaseVersionConsistency({
      packageVersion: "3.4.0",
      changelog: changelog("3.4.0", "3.3.0"),
      tags: ["v3.4.0", "v3.3.0"],
      releaseTag: "v3.3.0"
    });

    expect(result.errors).toContain("release tag v3.3.0 must match package.json as v3.4.0");
  });

  it("rejects semantic tags missing from the changelog", () => {
    const result = validateReleaseVersionConsistency({
      packageVersion: "3.4.0",
      changelog: changelog("3.4.0", "3.3.0"),
      tags: ["v3.4.0", "v3.3.0", "v3.2.0"]
    });

    expect(result.errors).toContain("semantic tag v3.2.0 has no matching CHANGELOG.md release heading");
  });

  it("parses only dated semantic release headings", () => {
    expect(parseChangelogReleases("# Changelog\n\n## [Unreleased]\n\n## [3.3.0] - 2026-08-26\n\n## Notes")).toEqual([
      { version: "3.3.0", date: "2026-08-26" }
    ]);
  });
});
