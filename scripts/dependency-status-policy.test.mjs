import { describe, expect, it } from "vitest";
import {
  DEPENDENCY_STATUS,
  classifyDependencyStatus,
  releaseAgeEligibleVersions,
  validateCompatibilityExceptionPackages,
  validatePeerRangeCompatibility,
  validateRuntimeMajorCompatibility
} from "./dependency-status-policy.mjs";

function classify(overrides = {}) {
  return classifyDependencyStatus({
    manifestVersion: "^1.0.2",
    installedVersion: "1.0.2",
    registryLatest: "1.0.2",
    ...overrides
  });
}

describe("direct dependency latest policy", () => {
  it("keeps compatibility validation behind the same 72-hour release-age gate", () => {
    expect(
      releaseAgeEligibleVersions({
        versionTimes: {
          "1.0.0": "2026-07-31T08:00:00.000Z",
          "1.1.0": "2026-08-01T08:00:00.000Z",
          "1.2.0": "2026-08-02T08:00:00.000Z",
          "1.3.0-beta.1": "2026-07-01T08:00:00.000Z",
          "2.0.0": "2026-07-01T08:00:00.000Z"
        },
        registryLatest: "1.2.0",
        now: Date.parse("2026-08-04T08:00:00.000Z")
      })
    ).toEqual(["1.0.0", "1.1.0"]);
  });

  it("accepts a stable registry-latest installation", () => {
    expect(classify()).toEqual({
      status: DEPENDENCY_STATUS.registryLatest,
      reason: "Installed version matches the stable registry latest.",
      registryLatest: "1.0.2"
    });
  });

  it("rejects a direct dependency behind registry latest", () => {
    const result = classify({
      manifestVersion: "^1.0.1",
      installedVersion: "1.0.1"
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.outdated);
    expect(result.reason).toContain("lower than release-age-eligible latest 1.0.2");
  });

  it("does not accept a dependency behind the release-age-eligible latest", () => {
    const result = classify({
      manifestVersion: "^1.0.1",
      installedVersion: "1.0.1"
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.outdated);
  });

  it("accepts an installed version while a newer release completes the 72-hour window", () => {
    const result = classify({
      manifestVersion: "^1.0.1",
      installedVersion: "1.0.1",
      eligibleLatest: "1.0.1",
      registryLatestPublishedAt: "2026-07-31T08:00:00.000Z",
      now: Date.parse("2026-08-01T08:00:00.000Z")
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.releaseAgePending);
    expect(result.reason).toContain("current eligible latest is 1.0.1");
    expect(result.reason).toContain("2026-08-03T08:00:00.000Z");
  });

  it("rejects the same version after registry latest becomes age eligible", () => {
    const result = classify({
      manifestVersion: "^1.0.1",
      installedVersion: "1.0.1",
      eligibleLatest: "1.0.1",
      registryLatestPublishedAt: "2026-07-28T08:00:00.000Z",
      now: Date.parse("2026-08-01T08:00:00.000Z")
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.outdated);
    expect(result.reason).toContain("no active release-age window");
  });

  it("accepts the stable registry latest without publication metadata", () => {
    const result = classify();

    expect(result.status).toBe(DEPENDENCY_STATUS.registryLatest);
  });

  it("fails closed on a registry request failure", () => {
    const result = classify({ registryError: "registry request failed" });

    expect(result.status).toBe(DEPENDENCY_STATUS.registryError);
    expect(result.reason).toBe("registry request failed");
  });

  it("fails closed on malformed registry data", () => {
    expect(classify({ registryLatest: "not-a-version" }).status).toBe(DEPENDENCY_STATUS.registryError);
  });

  it("rejects a prerelease selection", () => {
    const result = classify({
      manifestVersion: "^1.0.2-beta.1",
      installedVersion: "1.0.2-beta.1"
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.invalidManifest);
    expect(result.reason).toContain("prerelease");
  });

  it("rejects a manifest anchor lower than the installed lockfile version", () => {
    const result = classify({
      manifestVersion: "^1.0.1",
      installedVersion: "1.0.2"
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.invalidManifest);
    expect(result.reason).toContain("does not match installed 1.0.2");
  });

  it("rejects a selected version newer than registry latest", () => {
    const result = classify({
      manifestVersion: "^1.0.3",
      installedVersion: "1.0.3"
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.outdated);
    expect(result.reason).toContain("newer than stable registry latest 1.0.2");
  });

  it("accepts a machine-validated compatibility exception", () => {
    const result = classify({
      manifestVersion: "^1.0.1",
      installedVersion: "1.0.1",
      compatibilityValidation: {
        valid: true,
        reason: "The selected version is the newest version permitted by the active constraint."
      }
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.compatibilityException);
  });

  it("rejects a stale compatibility exception", () => {
    const result = classify({
      compatibilityValidation: {
        valid: false,
        errors: ["exception is stale because registry latest satisfies the peer range"]
      }
    });

    expect(result.status).toBe(DEPENDENCY_STATUS.invalidException);
  });

  it("allows exactly the two established compatibility exception packages", () => {
    expect(
      validateCompatibilityExceptionPackages({
        typescript: {},
        "@types/node": {}
      })
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects any newly invented compatibility exception", () => {
    const result = validateCompatibilityExceptionPackages({
      typescript: {},
      "@types/node": {},
      wrangler: {}
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("wrangler is not an allowed compatibility exception");
  });

  it("rejects removal of either established compatibility exception", () => {
    const result = validateCompatibilityExceptionPackages({ typescript: {} });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("@types/node compatibility exception is missing");
  });

  it("validates the TypeScript selection against the typescript-eslint peer range", () => {
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

  it("rejects a stale TypeScript compatibility exception", () => {
    const result = validatePeerRangeCompatibility({
      selectedVersion: "6.0.3",
      registryLatest: "6.0.4",
      peerRange: ">=4.8.4 <7.0.0",
      availableVersions: ["6.0.2", "6.0.3", "6.0.4"],
      peerPackage: "typescript-eslint"
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("exception is stale because registry latest 6.0.4 satisfies >=4.8.4 <7.0.0");
  });

  it("rejects a TypeScript selection that is not the newest peer-compatible release", () => {
    const result = validatePeerRangeCompatibility({
      selectedVersion: "6.0.3",
      registryLatest: "7.0.2",
      peerRange: ">=4.8.4 <7.0.2",
      availableVersions: ["6.0.3", "7.0.1", "7.0.2"],
      peerPackage: "typescript-eslint"
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "selected 6.0.3 is not the latest registry version compatible with >=4.8.4 <7.0.2 (7.0.1)"
    );
  });

  it("validates @types/node against the active runtime major", () => {
    expect(
      validateRuntimeMajorCompatibility({
        selectedVersion: "24.13.3",
        registryLatest: "26.1.2",
        runtimeVersion: "24.13.0",
        availableVersions: ["24.13.2", "24.13.3"]
      })
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects a stale @types/node runtime-major exception", () => {
    const result = validateRuntimeMajorCompatibility({
      selectedVersion: "24.13.3",
      registryLatest: "24.13.4",
      runtimeVersion: "24.13.0",
      availableVersions: ["24.13.3", "24.13.4"]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("exception is stale because registry latest matches the runtime major");
    expect(result.errors).toContain("selected 24.13.3 is not latest in runtime major 24 (24.13.4)");
  });

  it("rejects a downgraded runtime-major compatibility selection", () => {
    const result = validateRuntimeMajorCompatibility({
      selectedVersion: "24.13.2",
      registryLatest: "26.1.2",
      runtimeVersion: "24.13.0",
      availableVersions: ["24.13.2", "24.13.3"]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("selected 24.13.2 is not latest in runtime major 24 (24.13.3)");
  });
});
