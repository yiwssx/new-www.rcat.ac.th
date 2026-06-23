import type { User } from "../../types";

export const ADMIN_READ_ONLY_NOTICE = "บัญชีนี้เป็นสิทธิ์อ่านอย่างเดียว ไม่สามารถแก้ไขข้อมูลได้";

type RoleCarrier = Pick<User, "role"> | null | undefined;

export function canReadAdminData(user: RoleCarrier) {
  return user?.role === "admin" || user?.role === "editor" || user?.role === "viewer";
}

export function canManageAdminData(user: RoleCarrier) {
  return user?.role === "admin";
}

export function isReadOnlyAdminUser(user: RoleCarrier) {
  return user?.role === "editor" || user?.role === "viewer";
}
