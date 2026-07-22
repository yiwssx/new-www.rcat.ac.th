// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ADMIN_CAPABILITIES,
  ROLE_CAPABILITIES,
  hasAdminCapability,
  type AdminCapability
} from "../src/auth/adminCapabilities";

const roles = ["admin", "editor", "viewer", "invalid"] as const;

describe("Admin authorization matrix", () => {
  it.each(ADMIN_CAPABILITIES)("enforces the exact role matrix for %s", (capability) => {
    for (const role of roles) {
      const expected =
        role === "invalid" ? false : (ROLE_CAPABILITIES[role] as readonly AdminCapability[]).includes(capability);
      expect(hasAdminCapability(role, capability), `${role}: ${capability}`).toBe(expected);
    }
  });

  it("allows approved Editor publishing and managed editorial resources", () => {
    expect(hasAdminCapability("editor", "content.publish")).toBe(true);
    expect(hasAdminCapability("editor", "media.manage")).toBe(true);
    expect(hasAdminCapability("editor", "events.manage")).toBe(true);
    expect(hasAdminCapability("editor", "carousel.manage")).toBe(true);
  });

  it("denies Editor system configuration and global user management", () => {
    expect(hasAdminCapability("editor", "external-services.manage")).toBe(false);
    expect(hasAdminCapability("editor", "menu.manage")).toBe(false);
    expect(hasAdminCapability("editor", "settings.manage")).toBe(false);
    expect(hasAdminCapability("editor", "users.update-any")).toBe(false);
    expect(hasAdminCapability("editor", "users.read-all")).toBe(false);
  });

  it("allows only Admin to download backups and bootstrap the Root credential", () => {
    for (const capability of ["backup.download", "auth.bootstrap-root-credential"] as const) {
      expect(hasAdminCapability("admin", capability)).toBe(true);
      expect(hasAdminCapability("editor", capability)).toBe(false);
      expect(hasAdminCapability("viewer", capability)).toBe(false);
      expect(hasAdminCapability("invalid", capability)).toBe(false);
    }
  });

  it("denies every Viewer mutation", () => {
    const viewerCapabilities = new Set<AdminCapability>(ROLE_CAPABILITIES.viewer);
    expect(
      ADMIN_CAPABILITIES.filter((capability) => !viewerCapabilities.has(capability)).every(
        (capability) => !hasAdminCapability("viewer", capability)
      )
    ).toBe(true);
  });
});
