// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CMS_REAUTH_FRESHNESS_SECONDS, hasRecentAdminAssurance, requireAdminStepUp } from "../src/auth/adminStepUp";
import type { AdminIdentity } from "../src/auth/adminAccess";

const now = new Date("2026-07-23T03:00:00.000Z");
const identity: AdminIdentity = {
  actor: "admin@example.invalid",
  email: "admin@example.invalid",
  mode: "cms-session",
  role: "admin",
  reauthenticatedAt: now.toISOString(),
  mfaVerifiedAt: now.toISOString()
};

describe("CMS reauthentication assurance", () => {
  it("accepts a canonical recent timestamp but treats the exact ten-minute boundary as stale", () => {
    expect(hasRecentAdminAssurance(identity, "password", now)).toBe(true);
    expect(
      hasRecentAdminAssurance(
        {
          ...identity,
          reauthenticatedAt: new Date(now.getTime() - CMS_REAUTH_FRESHNESS_SECONDS * 1000).toISOString()
        },
        "password",
        now
      )
    ).toBe(false);
  });

  it("fails closed for malformed and future assurance", () => {
    expect(hasRecentAdminAssurance({ ...identity, mfaVerifiedAt: "not-a-time" }, "mfa", now)).toBe(false);
    expect(
      hasRecentAdminAssurance({ ...identity, mfaVerifiedAt: new Date(now.getTime() + 1).toISOString() }, "mfa", now)
    ).toBe(false);
  });

  it("requires recent MFA when a Root CMS Session targets its own user route", async () => {
    const response = await requireAdminStepUp({
      env: {},
      identity: { ...identity, isRoot: true, mfaVerifiedAt: "" },
      method: "PATCH",
      segments: ["users", "me"],
      now
    });
    expect(response?.status).toBe(428);
    expect(await response?.json()).toMatchObject({ assurance: "mfa" });
  });
});
