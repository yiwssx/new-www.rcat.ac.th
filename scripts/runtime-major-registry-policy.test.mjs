import { describe, expect, it } from "vitest";
import { resolveCompatibilityRegistryWindow } from "./runtime-major-registry-policy.mjs";

const versionTimes = {
  "22.20.1": "2026-09-01T00:00:00.000Z",
  "22.20.2": "2026-09-02T00:00:00.000Z",
  "24.13.2": "2026-09-01T00:00:00.000Z",
  "24.13.3": "2026-09-02T00:00:00.000Z",
  "26.4.1": "2026-09-01T00:00:00.000Z",
  "26.5.0": "2026-09-02T00:00:00.000Z"
};
const now = Date.parse("2026-09-10T00:00:00.000Z");

describe("runtime-major registry validation window", () => {
  it("does not let a regressed cross-major latest dist-tag force a runtime type downgrade", () => {
    expect(
      resolveCompatibilityRegistryWindow({
        distTagLatest: "22.20.2",
        versionTimes,
        validationKind: "runtime-major",
        minimumReleaseAgeHours: 72,
        now
      })
    ).toEqual({
      latest: "26.5.0",
      eligibleVersions: ["22.20.1", "22.20.2", "24.13.2", "24.13.3", "26.4.1", "26.5.0"]
    });
  });

  it("keeps ordinary dependency validation bounded by the actual latest dist-tag", () => {
    expect(
      resolveCompatibilityRegistryWindow({
        distTagLatest: "22.20.2",
        versionTimes,
        validationKind: "peer-range",
        minimumReleaseAgeHours: 72,
        now
      })
    ).toEqual({
      latest: "22.20.2",
      eligibleVersions: ["22.20.1", "22.20.2"]
    });
  });
});
