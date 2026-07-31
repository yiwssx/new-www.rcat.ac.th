const ISO_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

export const DEPENDENCY_STATUS = Object.freeze({
  registryLatest: "Registry latest",
  compatibilityException: "Validated compatibility exception",
  releaseAgeHold: "Validated release-age hold",
  outdated: "Outdated",
  invalidReleaseAge: "Invalid release-age selection",
  registryError: "Registry error",
  missingInstallation: "Missing installation",
  invalidManifest: "Invalid manifest",
  invalidException: "Invalid exception"
});

export const ACCEPTED_DEPENDENCY_STATUSES = new Set([
  DEPENDENCY_STATUS.registryLatest,
  DEPENDENCY_STATUS.compatibilityException,
  DEPENDENCY_STATUS.releaseAgeHold
]);

export function parseVersion(value) {
  const match = String(value || "")
    .trim()
    .match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/u);
  if (!match) return null;
  const numericParts = match.slice(1, 4);
  if (
    numericParts.some((part) => (part.length > 1 && part.startsWith("0")) || !Number.isSafeInteger(Number(part))) ||
    (match[4] &&
      match[4].split(".").some((part) => !part || (/^\d+$/u.test(part) && part.length > 1 && part.startsWith("0"))))
  ) {
    return null;
  }
  return {
    raw: `${match[1]}.${match[2]}.${match[3]}${match[4] ? `-${match[4]}` : ""}`,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || ""
  };
}

function compareIdentifiers(left, right) {
  const leftNumeric = /^\d+$/u.test(left);
  const rightNumeric = /^\d+$/u.test(right);
  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return left.localeCompare(right);
}

export function compareVersions(leftValue, rightValue) {
  const left = typeof leftValue === "string" ? parseVersion(leftValue) : leftValue;
  const right = typeof rightValue === "string" ? parseVersion(rightValue) : rightValue;
  if (!left || !right) throw new Error("Cannot compare invalid semantic versions.");
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  if (!left.prerelease && !right.prerelease) return 0;
  if (!left.prerelease) return 1;
  if (!right.prerelease) return -1;
  const leftParts = left.prerelease.split(".");
  const rightParts = right.prerelease.split(".");
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    if (leftParts[index] === undefined) return -1;
    if (rightParts[index] === undefined) return 1;
    const comparison = compareIdentifiers(leftParts[index], rightParts[index]);
    if (comparison) return comparison;
  }
  return 0;
}

function satisfiesComparator(version, comparator) {
  const match = comparator.match(/^(<=|>=|<|>|=|\^|~)?(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/u);
  if (!match) return false;
  const operator = match[1] || "=";
  const target = parseVersion(match[2]);
  const comparison = compareVersions(version, target);
  if (operator === "=") return comparison === 0;
  if (operator === ">") return comparison > 0;
  if (operator === ">=") return comparison >= 0;
  if (operator === "<") return comparison < 0;
  if (operator === "<=") return comparison <= 0;
  if (operator === "~") {
    const upper = { ...target, minor: target.minor + 1, patch: 0, prerelease: "" };
    return comparison >= 0 && compareVersions(version, upper) < 0;
  }
  const upper =
    target.major > 0
      ? { ...target, major: target.major + 1, minor: 0, patch: 0, prerelease: "" }
      : target.minor > 0
        ? { ...target, minor: target.minor + 1, patch: 0, prerelease: "" }
        : { ...target, patch: target.patch + 1, prerelease: "" };
  return comparison >= 0 && compareVersions(version, upper) < 0;
}

function satisfiesRange(versionValue, range) {
  const version = typeof versionValue === "string" ? parseVersion(versionValue) : versionValue;
  if (!version || typeof range !== "string" || !range.trim()) return false;
  return range.split("||").some((alternative) => {
    const comparators = alternative.trim().split(/\s+/u).filter(Boolean);
    return comparators.length > 0 && comparators.every((comparator) => satisfiesComparator(version, comparator));
  });
}

function parseManifestSpecifier(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\^|~)?(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/u);
  if (!match) return null;
  const version = parseVersion(match[2]);
  if (!version) return null;
  return {
    display: text,
    range: `${match[1] || ""}${version.raw}`,
    version
  };
}

function maxStableVersion(values, predicate = () => true) {
  const versions = values
    .map((value) => parseVersion(value))
    .filter((version) => version && !version.prerelease && predicate(version));
  versions.sort(compareVersions);
  return versions.at(-1)?.raw || "";
}

export function validatePeerRangeCompatibility({
  selectedVersion,
  registryLatest,
  peerRange,
  availableVersions,
  peerPackage = "peer package"
}) {
  const errors = [];
  const selected = parseVersion(selectedVersion);
  const latest = parseVersion(registryLatest);
  if (!selected || selected.prerelease) errors.push("selected compatibility version must be stable semantic version");
  if (!latest || latest.prerelease) errors.push("registry latest must be stable semantic version");
  if (typeof peerRange !== "string" || !peerRange.trim()) errors.push("peer range is missing or invalid");
  if (
    !Array.isArray(availableVersions) ||
    !availableVersions.length ||
    availableVersions.some((version) => !parseVersion(version))
  ) {
    errors.push("compatible version inventory is missing or invalid");
  }
  if (errors.length) return { valid: false, errors };

  if (compareVersions(selected, latest) > 0) {
    errors.push(`selected ${selected.raw} is newer than registry latest ${latest.raw}`);
  }
  if (!satisfiesRange(selected, peerRange)) {
    errors.push(`selected ${selected.raw} does not satisfy ${peerPackage} peer range ${peerRange}`);
  }
  if (satisfiesRange(latest, peerRange)) {
    errors.push(`exception is stale because registry latest ${latest.raw} satisfies ${peerRange}`);
  }
  if (latest.major - selected.major > 10) {
    errors.push("selected and registry latest majors are implausibly far apart");
  } else {
    const latestCompatible = maxStableVersion(availableVersions, (version) => satisfiesRange(version, peerRange));
    if (latestCompatible !== selected.raw) {
      errors.push(
        `selected ${selected.raw} is not the latest registry version compatible with ${peerRange} (${latestCompatible || "none"})`
      );
    }
  }
  return { valid: errors.length === 0, errors };
}

export function parseMinimumReleaseAgeMinutes(workspaceConfig) {
  const matches = [...String(workspaceConfig).matchAll(/^minimumReleaseAge:\s*(\d+)\s*$/gmu)];
  if (matches.length !== 1) {
    throw new Error("pnpm-workspace.yaml must declare minimumReleaseAge exactly once.");
  }
  const minutes = Number(matches[0][1]);
  if (!Number.isSafeInteger(minutes) || minutes <= 0) {
    throw new Error("minimumReleaseAge must be a positive integer number of minutes.");
  }
  return minutes;
}

function parseClock(value) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && ISO_UTC_TIMESTAMP.test(value)) {
    const milliseconds = Date.parse(value);
    const normalized = value.includes(".") ? value : value.replace(/Z$/u, ".000Z");
    return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === normalized ? milliseconds : null;
  }
  return null;
}

function isoTimestamp(milliseconds) {
  return new Date(milliseconds).toISOString();
}

function releaseAgeError(reason) {
  return {
    valid: false,
    error: reason,
    newestEligibleStable: "—",
    publishedAt: "—",
    eligibleAt: "—",
    latestEligible: false
  };
}

export function evaluateReleaseAge({
  installedVersion,
  registryLatest,
  registryVersions,
  releaseTimes,
  minimumReleaseAgeMinutes,
  now
}) {
  const installed = parseVersion(installedVersion);
  const latest = parseVersion(registryLatest);
  const nowMilliseconds = parseClock(now);

  if (!installed || installed.prerelease) {
    return releaseAgeError("installed version must be a stable semantic version");
  }
  if (!latest || latest.prerelease) {
    return releaseAgeError("registry latest must be a stable semantic version");
  }
  if (!Number.isSafeInteger(minimumReleaseAgeMinutes) || minimumReleaseAgeMinutes <= 0) {
    return releaseAgeError("minimum release age must be a positive integer number of minutes");
  }
  if (nowMilliseconds === null) {
    return releaseAgeError("controlled clock is invalid");
  }
  if (!releaseTimes || typeof releaseTimes !== "object" || Array.isArray(releaseTimes)) {
    return releaseAgeError("registry time metadata is missing");
  }
  if (!Array.isArray(registryVersions) || !registryVersions.length) {
    return releaseAgeError("registry version inventory is missing");
  }

  const parsedInventory = registryVersions.map((versionValue) => parseVersion(versionValue));
  if (parsedInventory.some((version) => !version)) {
    return releaseAgeError("registry version inventory contains a malformed semantic version");
  }
  if (!parsedInventory.some((version) => version.raw === latest.raw)) {
    return releaseAgeError(`registry version inventory is missing registry latest ${latest.raw}`);
  }
  if (!parsedInventory.some((version) => version.raw === installed.raw)) {
    return releaseAgeError(`registry version inventory is missing installed version ${installed.raw}`);
  }
  if (compareVersions(installed, latest) > 0) {
    return releaseAgeError(`installed version ${installed.raw} is newer than registry latest ${latest.raw}`);
  }

  const stableCandidates = parsedInventory
    .filter((version) => !version.prerelease && compareVersions(version, latest) <= 0)
    .map((version) => {
      if (!Object.hasOwn(releaseTimes, version.raw)) {
        return { error: `registry time metadata is missing stable version ${version.raw}` };
      }
      const publishedMilliseconds = parseClock(releaseTimes[version.raw]);
      if (publishedMilliseconds === null) {
        return { error: `registry time metadata for ${version.raw} is malformed` };
      }
      if (publishedMilliseconds > nowMilliseconds) {
        return { error: `registry publication time for ${version.raw} is in the future` };
      }
      return { version, publishedMilliseconds };
    });
  const invalidCandidate = stableCandidates.find((release) => release.error);
  if (invalidCandidate) {
    return releaseAgeError(invalidCandidate.error);
  }
  if (!stableCandidates.length) {
    return releaseAgeError("registry metadata contains no stable release at or below registry latest");
  }

  const latestRelease = stableCandidates.find((release) => release.version.raw === latest.raw);
  const minimumAgeMilliseconds = minimumReleaseAgeMinutes * 60_000;
  const eligibleReleases = stableCandidates
    .filter((release) => release.publishedMilliseconds + minimumAgeMilliseconds <= nowMilliseconds)
    .sort((left, right) => compareVersions(left.version, right.version));
  const newestEligible = eligibleReleases.at(-1);
  if (!newestEligible) {
    return releaseAgeError("registry time metadata contains no stable release old enough to install");
  }

  const latestEligibleAt = latestRelease.publishedMilliseconds + minimumAgeMilliseconds;
  return {
    valid: true,
    error: "",
    newestEligibleStable: newestEligible.version.raw,
    publishedAt: isoTimestamp(latestRelease.publishedMilliseconds),
    eligibleAt: isoTimestamp(latestEligibleAt),
    latestEligible: latestEligibleAt <= nowMilliseconds
  };
}

function baseResult({
  status,
  reason,
  registryLatest = "—",
  newestEligibleStable = "—",
  publishedAt = "—",
  eligibleAt = "—"
}) {
  return {
    status,
    reason,
    registryLatest,
    newestEligibleStable,
    publishedAt,
    eligibleAt
  };
}

export function classifyDependencyStatus({
  manifestVersion,
  installedVersion,
  registryLatest,
  registryError = "",
  compatibilityValidation,
  registryVersions,
  releaseTimes,
  minimumReleaseAgeMinutes,
  now
}) {
  const manifest = parseManifestSpecifier(manifestVersion);
  const installed = parseVersion(installedVersion);
  const latest = parseVersion(registryLatest);

  if (registryError) {
    return baseResult({
      status: DEPENDENCY_STATUS.registryError,
      reason: registryError
    });
  }
  if (!latest || latest.prerelease) {
    return baseResult({
      status: DEPENDENCY_STATUS.registryError,
      reason: "registry latest is missing, malformed, or a prerelease",
      registryLatest: registryLatest || "—"
    });
  }
  if (!manifest || manifest.version.prerelease) {
    return baseResult({
      status: DEPENDENCY_STATUS.invalidManifest,
      reason: "manifest must select a stable semantic version",
      registryLatest: latest.raw
    });
  }
  if (!installed) {
    return baseResult({
      status: DEPENDENCY_STATUS.missingInstallation,
      reason: "direct dependency is not installed",
      registryLatest: latest.raw
    });
  }
  if (installed.prerelease) {
    return baseResult({
      status: DEPENDENCY_STATUS.invalidManifest,
      reason: "installed direct dependency is a prerelease",
      registryLatest: latest.raw
    });
  }
  if (!satisfiesRange(installed, manifest.range)) {
    return baseResult({
      status: DEPENDENCY_STATUS.invalidManifest,
      reason: `manifest ${manifest.display} does not allow installed ${installed.raw}`,
      registryLatest: latest.raw
    });
  }

  if (compatibilityValidation) {
    if (compatibilityValidation.valid) {
      return baseResult({
        status: DEPENDENCY_STATUS.compatibilityException,
        reason: compatibilityValidation.reason,
        registryLatest: latest.raw
      });
    }
    return baseResult({
      status: DEPENDENCY_STATUS.invalidException,
      reason: compatibilityValidation.errors?.join("; ") || "compatibility exception validation failed",
      registryLatest: latest.raw
    });
  }

  if (installed.raw === latest.raw) {
    return baseResult({
      status: DEPENDENCY_STATUS.registryLatest,
      reason: "Installed version matches the stable registry latest.",
      registryLatest: latest.raw,
      newestEligibleStable: latest.raw
    });
  }

  const releaseAge = evaluateReleaseAge({
    installedVersion: installed.raw,
    registryLatest: latest.raw,
    registryVersions,
    releaseTimes,
    minimumReleaseAgeMinutes,
    now
  });
  if (!releaseAge.valid) {
    return baseResult({
      status: DEPENDENCY_STATUS.registryError,
      reason: releaseAge.error,
      registryLatest: latest.raw
    });
  }

  const releaseFields = {
    registryLatest: latest.raw,
    newestEligibleStable: releaseAge.newestEligibleStable,
    publishedAt: releaseAge.publishedAt,
    eligibleAt: releaseAge.eligibleAt
  };
  if (releaseAge.latestEligible) {
    return baseResult({
      ...releaseFields,
      status: DEPENDENCY_STATUS.outdated,
      reason: `Registry latest ${latest.raw} has satisfied the minimum release age.`
    });
  }
  if (installed.raw !== releaseAge.newestEligibleStable) {
    const comparison = compareVersions(installed, releaseAge.newestEligibleStable);
    return baseResult({
      ...releaseFields,
      status: comparison < 0 ? DEPENDENCY_STATUS.outdated : DEPENDENCY_STATUS.invalidReleaseAge,
      reason: `Installed ${installed.raw} is not the newest eligible stable release ${releaseAge.newestEligibleStable}.`
    });
  }
  return baseResult({
    ...releaseFields,
    status: DEPENDENCY_STATUS.releaseAgeHold,
    reason: `Registry latest ${latest.raw} remains ineligible until ${releaseAge.eligibleAt}.`
  });
}
