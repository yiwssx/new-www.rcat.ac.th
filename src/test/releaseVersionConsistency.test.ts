// @vitest-environment node

import { describe, expect, it } from "vitest";
// @ts-expect-error The runtime guard is an ESM .mjs module without a TypeScript declaration file.
import {
  parseChangelogReleases,
  validateReleaseVersionConsistency
} from "../../scripts/check-release-version-consistency.mjs";

const changelog = `# Changelog

## [Unreleased]

Pending work.

## [3.3.0] - 2026-08-26

Baseline.

## [3.2.0] - 2026-08-16

Previous baseline.
`;

// Regression coverage for the repository release/version governance helper.
describe("release version consistency guard", () => {
  it("accepts aligned package, changelog, and semantic tags", () => {
    const result = validateReleaseVersionConsistency({
      packageVersion: "3.3.0",
      changelog,
      tags: ["v3.3.0", "v3.2.0"]
    });

    expect(result).toEqual({ errors: [], warnings: [] });
  });

  it("requires package.json to match the newest dated changelog release", () => {
    const result = validateReleaseVersionConsistency({
      packageVersion: "3.4.0",
      changelog,
      tags: ["v3.3.0", "v3.2.0"]
    });

    expect(result.errors).toContain("package.json version 3.4.0 must match the newest CHANGELOG.md release 3.3.0");
  });

  it("rejects semantic tags that have no matching changelog release", () => {
    const result = validateReleaseVersionConsistency({
      packageVersion: "3.3.0",
      changelog,
      tags: ["v3.3.0", "v3.2.0", "v3.1.0"]
    });

    expect(result.errors).toContain("semantic tag v3.1.0 has no matching CHANGELOG.md release heading");
  });

  it("allows an untagged package version only as a release-preparation warning", () => {
    const result = validateReleaseVersionConsistency({
      packageVersion: "3.3.0",
      changelog,
      tags: ["v3.2.0"]
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain("v3.3.0 is not tagged yet; this is valid only while preparing the next release");
  });

  it("requires an explicit release tag to match package.json and the checked-out tag set", () => {
    const result = validateReleaseVersionConsistency({
      packageVersion: "3.3.0",
      changelog,
      tags: ["v3.3.0", "v3.2.0"],
      releaseTag: "v3.2.0"
    });

    expect(result.errors).toContain("release tag v3.2.0 must match package.json as v3.3.0");
  });

  it("parses dated semantic release headings but ignores Unreleased", () => {
    expect(parseChangelogReleases(changelog)).toEqual([
      { version: "3.3.0", date: "2026-08-26" },
      { version: "3.2.0", date: "2026-08-16" }
    ]);
  });
});
