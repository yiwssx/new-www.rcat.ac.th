import { compareVersions, parseVersion, releaseAgeEligibleVersions } from "./dependency-status-policy.mjs";

function highestStableVersion(versionTimes) {
  const versions = Object.keys(versionTimes || {})
    .map((value) => parseVersion(value))
    .filter((version) => version && !version.prerelease)
    .sort(compareVersions);
  return versions.at(-1)?.raw || "";
}

export function resolveCompatibilityRegistryWindow({
  distTagLatest,
  versionTimes,
  validationKind = "",
  minimumReleaseAgeHours = 72,
  now = Date.now()
}) {
  const distTagVersion = parseVersion(distTagLatest);
  if (!distTagVersion || distTagVersion.prerelease) {
    throw new Error("dist-tag latest must be a stable semantic version");
  }

  const validationLatest =
    validationKind === "runtime-major" ? highestStableVersion(versionTimes) || distTagVersion.raw : distTagVersion.raw;
  const eligibleVersions = releaseAgeEligibleVersions({
    versionTimes,
    registryLatest: validationLatest,
    minimumReleaseAgeHours,
    now
  });

  if (!eligibleVersions.length) {
    throw new Error("no stable validation release has passed the release-age gate");
  }

  return { latest: validationLatest, eligibleVersions };
}
