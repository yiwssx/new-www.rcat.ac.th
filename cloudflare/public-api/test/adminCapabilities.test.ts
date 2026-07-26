// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ADMIN_CAPABILITIES,
  ROLE_CAPABILITIES,
  getCapabilitiesForRole,
  hasAdminCapability,
  hasAnyAdminCapability,
  requireAnyAdminCapability,
  type AdminCapability
} from "../src/auth/adminCapabilities";

const EXPECTED_CAPABILITIES = [
  "dashboard.read",
  "content.read",
  "content.create",
  "content.update",
  "content.delete",
  "content.publish",
  "documents.read",
  "documents.create",
  "documents.update",
  "documents.delete",
  "documents.publish",
  "media.read",
  "media.manage",
  "events.read",
  "events.manage",
  "carousel.read",
  "carousel.manage",
  "external-services.read",
  "external-services.manage",
  "menu.read",
  "menu.manage",
  "settings.read",
  "settings.manage",
  "home-sections.read",
  "home-sections.manage",
  "visitor-stats.read",
  "visitor-stats.manage",
  "users.read-self",
  "users.read-all",
  "users.create",
  "users.update-self",
  "users.update-any",
  "users.delete",
  "users.invite",
  "users.reset-password",
  "users.revoke-sessions",
  "users.mfa.require",
  "users.mfa.reset",
  "backup.counts",
  "backup.download",
  "auth.change-password-self",
  "auth.reauthenticate-self",
  "auth.mfa.manage-self",
  "public-contracts.read"
] as const satisfies readonly AdminCapability[];

const EXPECTED_EDITOR_CAPABILITIES = [
  "dashboard.read",
  "content.read",
  "content.create",
  "content.update",
  "content.delete",
  "content.publish",
  "documents.read",
  "documents.create",
  "documents.update",
  "documents.delete",
  "documents.publish",
  "media.read",
  "media.manage",
  "events.read",
  "events.manage",
  "carousel.read",
  "carousel.manage",
  "external-services.read",
  "menu.read",
  "settings.read",
  "home-sections.read",
  "visitor-stats.read",
  "users.read-self",
  "users.update-self",
  "auth.change-password-self",
  "auth.reauthenticate-self",
  "auth.mfa.manage-self",
  "public-contracts.read"
] as const satisfies readonly AdminCapability[];

const EXPECTED_VIEWER_CAPABILITIES = [
  "dashboard.read",
  "content.read",
  "documents.read",
  "media.read",
  "events.read",
  "carousel.read",
  "external-services.read",
  "menu.read",
  "settings.read",
  "home-sections.read",
  "visitor-stats.read",
  "users.read-self",
  "auth.change-password-self",
  "auth.reauthenticate-self",
  "auth.mfa.manage-self",
  "public-contracts.read"
] as const satisfies readonly AdminCapability[];

describe("Admin capability registry", () => {
  it("contains each exact capability once and has no wildcard", () => {
    expect(ADMIN_CAPABILITIES).toEqual(EXPECTED_CAPABILITIES);
    expect(ADMIN_CAPABILITIES).toHaveLength(44);
    expect(new Set(ADMIN_CAPABILITIES).size).toBe(ADMIN_CAPABILITIES.length);
    expect(ADMIN_CAPABILITIES).not.toContain("*" as AdminCapability);
  });

  it("derives Admin from the complete registry and maps Editor and Viewer exactly", () => {
    expect(ROLE_CAPABILITIES.admin).toBe(ADMIN_CAPABILITIES);
    expect(getCapabilitiesForRole("admin")).toEqual(EXPECTED_CAPABILITIES);
    expect(getCapabilitiesForRole("editor")).toEqual(EXPECTED_EDITOR_CAPABILITIES);
    expect(getCapabilitiesForRole("viewer")).toEqual(EXPECTED_VIEWER_CAPABILITIES);
  });

  it("keeps restricted categories out of the Editor role", () => {
    expect(hasAdminCapability("editor", "external-services.manage")).toBe(false);
    expect(hasAdminCapability("editor", "menu.manage")).toBe(false);
    expect(hasAdminCapability("editor", "settings.manage")).toBe(false);
    expect(hasAdminCapability("editor", "users.update-self")).toBe(true);
    expect(hasAdminCapability("editor", "users.update-any")).toBe(false);
    expect(hasAdminCapability("editor", "auth.change-password-self")).toBe(true);
    expect(hasAdminCapability("editor", "auth.reauthenticate-self")).toBe(true);
    expect(hasAdminCapability("editor", "auth.mfa.manage-self")).toBe(true);
    expect(hasAdminCapability("editor", "users.invite")).toBe(false);
    expect(hasAdminCapability("editor", "users.reset-password")).toBe(false);
    expect(hasAdminCapability("editor", "users.revoke-sessions")).toBe(false);
  });

  it("gives Viewer no mutation capability", () => {
    const mutationCapabilities = ADMIN_CAPABILITIES.filter(
      (capability) =>
        !capability.endsWith(".read") &&
        capability !== "users.read-self" &&
        capability !== "users.read-all" &&
        !["auth.change-password-self", "auth.reauthenticate-self", "auth.mfa.manage-self"].includes(capability)
    );
    expect(mutationCapabilities.every((capability) => !hasAdminCapability("viewer", capability))).toBe(true);
    expect(hasAdminCapability("viewer", "auth.change-password-self")).toBe(true);
    expect(hasAdminCapability("viewer", "auth.reauthenticate-self")).toBe(true);
    expect(hasAdminCapability("viewer", "auth.mfa.manage-self")).toBe(true);
  });

  it.each([undefined, null, "", "root", "ADMIN", {}, { role: "" }, { role: "invalid" }])(
    "gives invalid role input %j zero capabilities",
    (role) => {
      expect(getCapabilitiesForRole(role)).toEqual([]);
      expect(hasAdminCapability(role, "dashboard.read")).toBe(false);
    }
  );

  it("returns frozen copies that cannot mutate the registry", () => {
    const capabilities = getCapabilitiesForRole("editor");

    expect(capabilities).not.toBe(ROLE_CAPABILITIES.editor);
    expect(Object.isFrozen(capabilities)).toBe(true);
    expect(() => (capabilities as AdminCapability[]).push("backup.download")).toThrow();
    expect(ROLE_CAPABILITIES.editor).toEqual(EXPECTED_EDITOR_CAPABILITIES);
    expect(ADMIN_CAPABILITIES).toEqual(EXPECTED_CAPABILITIES);
  });

  it("rejects unsupported capability values and fails closed for empty any-of requirements", async () => {
    expect(hasAdminCapability("admin", "made-up.permission")).toBe(false);
    expect(hasAnyAdminCapability("admin", [])).toBe(false);
    expect(hasAnyAdminCapability("editor", ["content.read", "content.read"])).toBe(true);

    const response = requireAnyAdminCapability(
      {
        actor: "admin@example.test",
        email: "admin@example.test",
        mode: "cms-session",
        role: "admin",
        userId: "admin-user-1",
        sessionId: "admin-session-1",
        isRoot: true,
        reauthenticatedAt: "2026-07-23T03:00:00.000Z",
        mfaVerifiedAt: "2026-07-23T03:00:00.000Z"
      },
      []
    );
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({ error: "required permission is missing" });
  });
});
