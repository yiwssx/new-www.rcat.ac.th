import { describe, expect, it } from "vitest";
import {
  DEPENDENCY_STATUS,
  classifyDependencyStatus,
  parseMinimumReleaseAgeMinutes,
  validatePeerRangeCompatibility
} from "./dependency-status-policy.mjs";

const MINIMUM_RELEASE_AGE_MINUTES = 4_320;
const BEFORE_LATEST_ELIGIBILITY = "2026-07-31T03:30:00.000Z";
const IMMEDIATELY_BEFORE_LATEST_ELIGIBILITY = "2026-08-01T23:59:59.999Z";
const AT_LATEST_ELIGIBILITY = "2026-08-02T00:00:00.000Z";
const registryVersions = ["1.0.0", "1.0.1", "1.0.2"];
const releaseTimes = {
  created: "2026-07-01T00:00:00.000Z",
  modified: "2026-07-30T00:00:00.000Z",
  "1.0.0": "2026-07-10T00:00:00.000Z",
  "1.0.1": "2026-07-25T00:00:00.000Z",
  "1.0.2": "2026-07-30T00:00:00.000Z"
};

function classify(overrides = {}) {
  return classifyDependencyStatus({
    manifestVersion: "1.0.1",
    installedVersion: "1.0.1",
    registryLatest: "1.0.2",
    registryVersions,
    releaseTimes,
    minimumReleaseAgeMinutes: MINIMUM_RELEASE_AGE_MINUTES,
    now: BEFORE_LATEST_ELIGIBILITY,
    ...overrides
  });
}

describe("dependency status release-age policy", () => {
  it("accepts an installed stable registry latest", () => {
    const result = classify({
      manifestVersion: "1.0.2",
      installedVersion: "1.0.2",
      releaseTimes: {
        ...releaseTimes,
        "1.0.2": "2026-07-20T00:00:00.000Z"
      }
    });

    expect(result).toMatchObject({
      status: DEPENDENCY_STATUS.registryLatest,
      newestEligibleStable: "1.0.2"
    });
  });

  it("accepts an installed registry latest that satisfies a caret manifest range", () => {
    const result = classify({
      manifestVersion: "^1.0.0",
      installedVersion: "1.0.2"
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.registryLatest);
  });

  it("rejects an installed version outside a tilde manifest range", () => {
    const result = classify({
      manifestVersion: "~1.0.0",
      installedVersion: "1.1.0",
      registryLatest: "1.1.0"
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.invalidManifest);
    expect(result.reason).toContain("does not allow installed 1.1.0");
  });

  it("rejects an outdated install once registry latest is old enough", () => {
    const result = classify({
      releaseTimes: {
        ...releaseTimes,
        "1.0.2": "2026-07-20T00:00:00.000Z"
      }
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.outdated);
    expect(result.reason).toContain("has satisfied the minimum release age");
  });

  it("accepts a release-age hold when installed is the newest eligible stable", () => {
    const result = classify();

    expect(result).toMatchObject({
      status: DEPENDENCY_STATUS.releaseAgeHold,
      newestEligibleStable: "1.0.1",
      publishedAt: "2026-07-30T00:00:00.000Z",
      eligibleAt: "2026-08-02T00:00:00.000Z"
    });
  });

  it("rejects a hold when another eligible stable release is newer than installed", () => {
    const result = classify({
      manifestVersion: "1.0.0",
      installedVersion: "1.0.0"
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.outdated);
    expect(result.reason).toContain("newest eligible stable release 1.0.1");
  });

  it("invalidates a release-age hold automatically after eligibility", () => {
    expect(classify({ now: IMMEDIATELY_BEFORE_LATEST_ELIGIBILITY }).status).toBe(DEPENDENCY_STATUS.releaseAgeHold);
    const result = classify({ now: AT_LATEST_ELIGIBILITY });

    expect(result.status).toBe(DEPENDENCY_STATUS.outdated);
  });

  it("fails closed on a registry lookup failure", () => {
    const result = classify({
      registryLatest: "",
      registryError: "registry request failed"
    });

    expect(result).toMatchObject({
      status: DEPENDENCY_STATUS.registryError,
      reason: "registry request failed"
    });
  });

  it("fails closed on malformed registry time metadata", () => {
    const result = classify({
      releaseTimes: {
        ...releaseTimes,
        "1.0.2": "not-a-timestamp"
      }
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.registryError);
    expect(result.reason).toContain("malformed");
  });

  it("rejects an installed prerelease", () => {
    const result = classify({
      manifestVersion: "1.0.1",
      installedVersion: "1.0.1-beta.1",
      registryVersions: [...registryVersions, "1.0.1-beta.1"]
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.invalidManifest);
    expect(result.reason).toContain("installed direct dependency is a prerelease");
  });

  it("rejects a prerelease registry latest", () => {
    const result = classify({
      registryLatest: "1.0.2-rc.1",
      registryVersions: [...registryVersions, "1.0.2-rc.1"]
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.registryError);
  });

  it("rejects an installed release newer than the newest eligible stable", () => {
    const result = classify({
      manifestVersion: "5.20260730.1",
      installedVersion: "5.20260730.1",
      registryLatest: "5.20260731.1",
      registryVersions: ["5.20260728.1", "5.20260729.1", "5.20260730.1", "5.20260731.1"],
      releaseTimes: {
        "5.20260728.1": "2026-07-28T01:09:36.211Z",
        "5.20260729.1": "2026-07-29T01:10:49.856Z",
        "5.20260730.1": "2026-07-30T01:08:28.951Z",
        "5.20260731.1": "2026-07-31T01:16:25.508Z"
      }
    });

    expect(result).toMatchObject({
      status: DEPENDENCY_STATUS.invalidReleaseAge,
      newestEligibleStable: "5.20260728.1"
    });
  });

  it("fails closed when a stable inventory version lacks time metadata", () => {
    const { ["1.0.1"]: omitted, ...incompleteTimes } = releaseTimes;
    expect(omitted).toBeDefined();

    const result = classify({ releaseTimes: incompleteTimes });

    expect(result.status).toBe(DEPENDENCY_STATUS.registryError);
    expect(result.reason).toContain("missing stable version 1.0.1");
  });

  it("fails closed when a registry timestamp names an impossible calendar date", () => {
    const result = classify({
      releaseTimes: {
        ...releaseTimes,
        "1.0.2": "2026-02-30T00:00:00.000Z"
      }
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.registryError);
    expect(result.reason).toContain("malformed");
  });

  it("accepts a validated compatibility exception", () => {
    const result = classify({
      registryLatest: "2.0.0",
      registryVersions: undefined,
      releaseTimes: undefined,
      compatibilityValidation: {
        valid: true,
        reason: "The installed version is the newest release allowed by a verified peer range."
      }
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.compatibilityException);
    expect(result.newestEligibleStable).toBe("—");
  });

  it("rejects a stale compatibility exception", () => {
    const result = classify({
      registryLatest: "2.0.0",
      registryVersions: undefined,
      releaseTimes: undefined,
      compatibilityValidation: {
        valid: false,
        errors: ["exception is stale because registry latest satisfies the peer range"]
      }
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.invalidException);
  });

  it("validates a compatibility exception against deterministic peer and version evidence", () => {
    expect(
      validatePeerRangeCompatibility({
        selectedVersion: "6.0.3",
        registryLatest: "7.0.2",
        peerRange: ">=4.8.4 <6.1.0",
        availableVersions: ["5.9.3", "6.0.2", "6.0.3", "7.0.2"],
        peerPackage: "typescript-eslint"
      })
    ).toEqual({ valid: true, errors: [] });
  });

  it("invalidates a compatibility exception when registry latest satisfies the peer range", () => {
    const result = validatePeerRangeCompatibility({
      selectedVersion: "6.0.3",
      registryLatest: "6.0.4",
      peerRange: ">=4.8.4 <7.0.0",
      availableVersions: ["6.0.2", "6.0.3", "6.0.4"],
      peerPackage: "typescript-eslint"
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("exception is stale because registry latest 6.0.4 satisfies >=4.8.4 <7.0.0");
    expect(result.errors).toContain(
      "selected 6.0.3 is not the latest registry version compatible with >=4.8.4 <7.0.0 (6.0.4)"
    );
  });

  it("invalidates a cross-major exception when an earlier release in the latest major is compatible", () => {
    const result = validatePeerRangeCompatibility({
      selectedVersion: "6.0.3",
      registryLatest: "7.0.2",
      peerRange: ">=4.8.4 <7.0.2",
      availableVersions: ["6.0.2", "6.0.3", "7.0.1", "7.0.2"],
      peerPackage: "typescript-eslint"
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "selected 6.0.3 is not the latest registry version compatible with >=4.8.4 <7.0.2 (7.0.1)"
    );
  });

  it("rejects a compatibility selection newer than registry latest", () => {
    const result = validatePeerRangeCompatibility({
      selectedVersion: "7.0.1",
      registryLatest: "6.0.4",
      peerRange: ">=4.8.4 <8.0.0",
      availableVersions: ["6.0.4", "7.0.1"],
      peerPackage: "typescript-eslint"
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("selected 7.0.1 is newer than registry latest 6.0.4");
  });

  it("parses the enforced minimum release age from workspace policy", () => {
    expect(parseMinimumReleaseAgeMinutes("packages:\n  - .\nminimumReleaseAge: 4320\n")).toBe(4_320);
    expect(() => parseMinimumReleaseAgeMinutes("packages:\n  - .\n")).toThrow(/exactly once/u);
  });
});
