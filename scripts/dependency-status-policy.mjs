export const DEPENDENCY_STATUS = Object.freeze({
  registryLatest: "Registry latest",
  releaseAgePending: "Pending release-age eligibility",
  compatibilityException: "Validated compatibility exception",
  outdated: "Outdated",
  registryError: "Registry error",
  missingInstallation: "Missing installation",
  invalidManifest: "Invalid manifest",
  invalidException: "Invalid exception"
});

export const ACCEPTED_DEPENDENCY_STATUSES = new Set([
  DEPENDENCY_STATUS.registryLatest,
  DEPENDENCY_STATUS.releaseAgePending,
  DEPENDENCY_STATUS.compatibilityException
]);

export const ALLOWED_COMPATIBILITY_EXCEPTION_PACKAGES = Object.freeze(["@types/node", "typescript"]);

export function validateCompatibilityExceptionPackages(exceptions) {
  if (!exceptions || typeof exceptions !== "object" || Array.isArray(exceptions)) {
    return {
      valid: false,
      errors: ["compatibilityExceptions must be an object"]
    };
  }

  const configured = Object.keys(exceptions).sort();
  const allowed = [...ALLOWED_COMPATIBILITY_EXCEPTION_PACKAGES].sort();
  const unsupported = configured.filter((packageName) => !allowed.includes(packageName));
  const missing = allowed.filter((packageName) => !configured.includes(packageName));
  const errors = [
    ...unsupported.map((packageName) => `${packageName} is not an allowed compatibility exception`),
    ...missing.map((packageName) => `${packageName} compatibility exception is missing`)
  ];

  return { valid: errors.length === 0, errors };
}

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

export function releaseAgeEligibleVersions({
  versionTimes,
  registryLatest,
  minimumReleaseAgeHours = 72,
  now = Date.now()
}) {
  const latest = typeof registryLatest === "string" ? parseVersion(registryLatest) : registryLatest;
  const nowMilliseconds = now instanceof Date ? now.getTime() : Number(now);
  const releaseAgeMilliseconds = Number(minimumReleaseAgeHours) * 60 * 60 * 1000;
  if (
    !latest ||
    latest.prerelease ||
    !versionTimes ||
    typeof versionTimes !== "object" ||
    Array.isArray(versionTimes) ||
    !Number.isFinite(nowMilliseconds) ||
    !Number.isFinite(releaseAgeMilliseconds) ||
    releaseAgeMilliseconds <= 0
  ) {
    return [];
  }

  const cutoff = nowMilliseconds - releaseAgeMilliseconds;
  return Object.entries(versionTimes)
    .map(([version, publishedAt]) => ({ version: parseVersion(version), publishedAt: Date.parse(publishedAt) }))
    .filter(
      (entry) =>
        entry.version &&
        !entry.version.prerelease &&
        Number.isFinite(entry.publishedAt) &&
        entry.publishedAt <= cutoff &&
        compareVersions(entry.version, latest) <= 0
    )
    .map((entry) => entry.version)
    .sort(compareVersions)
    .map((version) => version.raw);
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

export function validateRuntimeMajorCompatibility({
  selectedVersion,
  registryLatest,
  runtimeVersion,
  availableVersions
}) {
  const errors = [];
  const selected = parseVersion(selectedVersion);
  const latest = parseVersion(registryLatest);
  const runtime = parseVersion(runtimeVersion);
  if (!selected || selected.prerelease) errors.push("selected compatibility version must be stable semantic version");
  if (!latest || latest.prerelease) errors.push("registry latest must be stable semantic version");
  if (!runtime || runtime.prerelease) errors.push("runtime version must be stable semantic version");
  if (
    !Array.isArray(availableVersions) ||
    !availableVersions.length ||
    availableVersions.some((version) => !parseVersion(version))
  ) {
    errors.push("runtime-major version inventory is missing or invalid");
  }
  if (errors.length) return { valid: false, errors };

  if (selected.major !== runtime.major) {
    errors.push(`selected major ${selected.major} does not match runtime major ${runtime.major}`);
  }
  if (latest.major === runtime.major) {
    errors.push("exception is stale because registry latest matches the runtime major");
  }
  if (compareVersions(selected, latest) > 0) {
    errors.push(`selected ${selected.raw} is newer than registry latest ${latest.raw}`);
  }
  const latestRuntimeMajor = maxStableVersion(availableVersions, (version) => version.major === runtime.major);
  if (latestRuntimeMajor !== selected.raw) {
    errors.push(
      `selected ${selected.raw} is not latest in runtime major ${runtime.major} (${latestRuntimeMajor || "none"})`
    );
  }

  return { valid: errors.length === 0, errors };
}

function baseResult({ status, reason, registryLatest = "—" }) {
  return { status, reason, registryLatest };
}

export function classifyDependencyStatus({
  manifestVersion,
  installedVersion,
  registryLatest,
  eligibleLatest = registryLatest,
  registryLatestPublishedAt = "",
  minimumReleaseAgeHours = 72,
  now = Date.now(),
  registryError = "",
  compatibilityValidation
}) {
  const manifest = parseManifestSpecifier(manifestVersion);
  const installed = parseVersion(installedVersion);
  const latest = parseVersion(registryLatest);
  const eligible = parseVersion(eligibleLatest);

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
  if (!eligible || eligible.prerelease || compareVersions(eligible, latest) > 0) {
    return baseResult({
      status: DEPENDENCY_STATUS.registryError,
      reason: "release-age-eligible registry version is missing, malformed, or newer than registry latest",
      registryLatest: latest.raw
    });
  }
  if (!manifest || manifest.version.prerelease) {
    return baseResult({
      status: DEPENDENCY_STATUS.invalidManifest,
      reason: "manifest must select a stable semantic version, not a prerelease",
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
  if (manifest.version.raw !== installed.raw) {
    return baseResult({
      status: DEPENDENCY_STATUS.invalidManifest,
      reason: `manifest ${manifest.display} selects ${manifest.version.raw}, which does not match installed ${installed.raw}`,
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
      registryLatest: latest.raw
    });
  }

  if (compareVersions(installed, latest) > 0) {
    return baseResult({
      status: DEPENDENCY_STATUS.outdated,
      reason: `Installed ${installed.raw} is newer than stable registry latest ${latest.raw}.`,
      registryLatest: latest.raw
    });
  }

  if (compareVersions(installed, eligible) < 0) {
    return baseResult({
      status: DEPENDENCY_STATUS.outdated,
      reason: `Installed ${installed.raw} is lower than release-age-eligible latest ${eligible.raw}.`,
      registryLatest: latest.raw
    });
  }

  const publishedAtMilliseconds = Date.parse(registryLatestPublishedAt);
  const nowMilliseconds = now instanceof Date ? now.getTime() : Number(now);
  const releaseAgeMilliseconds = Number(minimumReleaseAgeHours) * 60 * 60 * 1000;
  const eligibleAtMilliseconds = publishedAtMilliseconds + releaseAgeMilliseconds;
  if (
    Number.isFinite(publishedAtMilliseconds) &&
    Number.isFinite(nowMilliseconds) &&
    Number.isFinite(releaseAgeMilliseconds) &&
    releaseAgeMilliseconds > 0 &&
    nowMilliseconds < eligibleAtMilliseconds
  ) {
    return baseResult({
      status: DEPENDENCY_STATUS.releaseAgePending,
      reason: `Registry latest ${latest.raw} was published at ${new Date(
        publishedAtMilliseconds
      ).toISOString()} and becomes eligible after ${new Date(eligibleAtMilliseconds).toISOString()}; current eligible latest is ${eligible.raw}.`,
      registryLatest: latest.raw
    });
  }

  return baseResult({
    status: DEPENDENCY_STATUS.outdated,
    reason: `Installed ${installed.raw} is lower than stable registry latest ${latest.raw}, and no active release-age window or compatibility exception permits it.`,
    registryLatest: latest.raw
  });
}
