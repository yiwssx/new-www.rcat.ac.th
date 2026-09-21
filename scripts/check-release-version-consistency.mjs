import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const RELEASE_HEADING_PATTERN = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/gm;

export function compareSemver(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);

  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function parseChangelogReleases(changelog) {
  return [...changelog.matchAll(RELEASE_HEADING_PATTERN)].map((match) => ({
    version: match[1],
    date: match[2]
  }));
}

export function validateReleaseVersionConsistency({
  packageVersion,
  changelog,
  tags,
  releaseTag = ""
}) {
  const errors = [];
  const warnings = [];

  if (!SEMVER_PATTERN.test(packageVersion)) {
    errors.push(`package.json version must be stable SemVer (x.y.z); received ${packageVersion}`);
    return { errors, warnings };
  }

  const releases = parseChangelogReleases(changelog);
  if (releases.length === 0) {
    errors.push("CHANGELOG.md must contain at least one dated semantic release heading");
    return { errors, warnings };
  }

  const releaseVersions = releases.map((release) => release.version);
  if (new Set(releaseVersions).size !== releaseVersions.length) {
    errors.push("CHANGELOG.md contains duplicate semantic release headings");
  }

  if (releases[0].version !== packageVersion) {
    errors.push(
      `package.json version ${packageVersion} must match the newest CHANGELOG.md release ${releases[0].version}`
    );
  }

  for (let index = 1; index < releaseVersions.length; index += 1) {
    if (compareSemver(releaseVersions[index - 1], releaseVersions[index]) <= 0) {
      errors.push("CHANGELOG.md semantic release headings must be ordered newest to oldest");
      break;
    }
  }

  const semverTags = tags
    .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
    .map((tag) => ({ tag, version: tag.slice(1) }))
    .sort((a, b) => compareSemver(b.version, a.version));

  if (semverTags.length === 0) {
    errors.push("No semantic Git tag was found; fetch repository tags before running the release guard");
  } else {
    const latestTag = semverTags[0];
    if (compareSemver(latestTag.version, packageVersion) > 0) {
      errors.push(
        `latest semantic tag ${latestTag.tag} is newer than package.json version ${packageVersion}`
      );
    }

    for (const { tag, version } of semverTags) {
      if (!releaseVersions.includes(version)) {
        errors.push(`semantic tag ${tag} has no matching CHANGELOG.md release heading`);
      }
    }

    if (!semverTags.some(({ version }) => version === packageVersion)) {
      warnings.push(
        `v${packageVersion} is not tagged yet; this is valid only while preparing the next release`
      );
    }
  }

  if (releaseTag) {
    const expectedTag = `v${packageVersion}`;
    if (releaseTag !== expectedTag) {
      errors.push(`release tag ${releaseTag} must match package.json as ${expectedTag}`);
    }
    if (!tags.includes(releaseTag)) {
      errors.push(`release tag ${releaseTag} is not present in the checked-out Git tag set`);
    }
  }

  return { errors, warnings };
}

function listTags() {
  try {
    return execFileSync("git", ["tag", "--list"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    })
      .split(/\r?\n/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  } catch (error) {
    throw new Error(`Unable to read Git tags: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function main() {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const changelog = fs.readFileSync("CHANGELOG.md", "utf8");
  const tags = listTags();
  const releaseTag =
    process.env.RELEASE_TAG ||
    (process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME || "" : "");

  const { errors, warnings } = validateReleaseVersionConsistency({
    packageVersion: packageJson.version,
    changelog,
    tags,
    releaseTag
  });

  for (const warning of warnings) {
    console.warn(`::warning title=Release version consistency::${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`::error title=Release version consistency::${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Release version consistency: PASS (package=${packageJson.version}, latest-tag=${
      tags.filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag)).sort((a, b) =>
        compareSemver(b.slice(1), a.slice(1))
      )[0]
    })`
  );
}

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entryPoint) main();
