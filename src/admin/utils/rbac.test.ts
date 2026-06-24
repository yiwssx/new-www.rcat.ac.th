import { describe, expect, it } from "vitest";
import {
  canManageAdminData,
  canManageContent,
  canManageIntegrations,
  canManageMedia,
  canManageMenu,
  canManageUsers,
  canManageWebsiteSettings,
  canPublishContent,
  canReadAdminData,
  canSelfEditUserProfile,
  isReadOnlyAdminUser
} from "./rbac";
import type { User } from "../../types";

function user(role: User["role"]): User {
  return {
    id: `test-${role}`,
    name: `Test ${role}`,
    email: `${role}@example.invalid`,
    role
  };
}

describe("admin RBAC helpers", () => {
  it("allows all authenticated admin roles to read admin data", () => {
    expect(canReadAdminData(user("admin"))).toBe(true);
    expect(canReadAdminData(user("editor"))).toBe(true);
    expect(canReadAdminData(user("viewer"))).toBe(true);
    expect(canReadAdminData(null)).toBe(false);
  });

  it("keeps global admin-data management limited to admin", () => {
    expect(canManageAdminData(user("admin"))).toBe(true);
    expect(canManageAdminData(user("editor"))).toBe(false);
    expect(canManageAdminData(user("viewer"))).toBe(false);
    expect(canManageAdminData(null)).toBe(false);
  });

  it("allows editors to manage content-related data while viewers remain read-only", () => {
    expect(canManageContent(user("admin"))).toBe(true);
    expect(canManageContent(user("editor"))).toBe(true);
    expect(canManageContent(user("viewer"))).toBe(false);
    expect(canPublishContent(user("editor"))).toBe(true);
    expect(canManageMedia(user("editor"))).toBe(true);
  });

  it("keeps settings, menu, integrations, and user management admin-only except editor self profile", () => {
    expect(canManageWebsiteSettings(user("admin"))).toBe(true);
    expect(canManageWebsiteSettings(user("editor"))).toBe(false);
    expect(canManageMenu(user("editor"))).toBe(false);
    expect(canManageIntegrations(user("editor"))).toBe(false);
    expect(canManageUsers(user("editor"))).toBe(false);
    expect(canSelfEditUserProfile(user("editor"))).toBe(true);
    expect(canSelfEditUserProfile(user("viewer"))).toBe(false);
  });

  it("treats only viewer sessions as fully read-only admin users", () => {
    expect(isReadOnlyAdminUser(user("admin"))).toBe(false);
    expect(isReadOnlyAdminUser(user("editor"))).toBe(false);
    expect(isReadOnlyAdminUser(user("viewer"))).toBe(true);
  });
});
