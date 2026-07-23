// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ADMIN_CAPABILITIES, getCapabilitiesForRole } from "../src/auth/adminCapabilities";
import { resolveAdminRoutePolicy } from "../src/auth/adminRoutePolicy";

describe("admin MFA management route policy", () => {
  it("adds exactly four Phase 6 capabilities with only MFA administration restricted to admins", () => {
    expect(ADMIN_CAPABILITIES).toHaveLength(45);
    expect(getCapabilitiesForRole("admin")).toEqual(
      expect.arrayContaining([
        "auth.reauthenticate-self",
        "auth.mfa.manage-self",
        "users.mfa.require",
        "users.mfa.reset"
      ])
    );
    expect(getCapabilitiesForRole("editor")).toEqual(
      expect.arrayContaining(["auth.reauthenticate-self", "auth.mfa.manage-self"])
    );
    expect(getCapabilitiesForRole("viewer")).not.toContain("users.mfa.reset");
  });

  it("maps exact MFA requirement and reset methods and rejects neighboring methods", () => {
    expect(resolveAdminRoutePolicy("POST", ["users", "user-1", "mfa-requirement"])).toMatchObject({
      matched: true,
      capability: "users.mfa.require"
    });
    expect(resolveAdminRoutePolicy("DELETE", ["users", "user-1", "mfa"])).toMatchObject({
      matched: true,
      capability: "users.mfa.reset"
    });
    expect(resolveAdminRoutePolicy("GET", ["users", "user-1", "mfa"])).toEqual({ matched: false });
  });
});
