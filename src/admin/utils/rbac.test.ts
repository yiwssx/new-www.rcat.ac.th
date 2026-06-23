import { describe, expect, it } from "vitest";
import { canManageAdminData, canReadAdminData, isReadOnlyAdminUser } from "./rbac";
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

  it("allows only admin to mutate admin data", () => {
    expect(canManageAdminData(user("admin"))).toBe(true);
    expect(canManageAdminData(user("editor"))).toBe(false);
    expect(canManageAdminData(user("viewer"))).toBe(false);
    expect(canManageAdminData(null)).toBe(false);
  });

  it("treats editor and viewer sessions as read-only admin users", () => {
    expect(isReadOnlyAdminUser(user("admin"))).toBe(false);
    expect(isReadOnlyAdminUser(user("editor"))).toBe(true);
    expect(isReadOnlyAdminUser(user("viewer"))).toBe(true);
  });
});
