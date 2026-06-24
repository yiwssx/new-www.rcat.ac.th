import type { User } from "../../types";

export const ADMIN_READ_ONLY_NOTICE =
  "บัญชี viewer สามารถดูข้อมูลเพื่อตรวจสอบก่อนเผยแพร่ได้ แต่ไม่สามารถแก้ไขข้อมูลได้";

type RoleCarrier = Pick<User, "role"> | null | undefined;

export function canReadAdminData(user: RoleCarrier) {
  return user?.role === "admin" || user?.role === "editor" || user?.role === "viewer";
}

export function canManageAdminData(user: RoleCarrier) {
  return user?.role === "admin";
}

export function canManageContent(user: RoleCarrier) {
  return user?.role === "admin" || user?.role === "editor";
}

export function canPublishContent(user: RoleCarrier) {
  return canManageContent(user);
}

export function canManageMedia(user: RoleCarrier) {
  return user?.role === "admin" || user?.role === "editor";
}

export function canManageWebsiteSettings(user: RoleCarrier) {
  return user?.role === "admin";
}

export function canManageMenu(user: RoleCarrier) {
  return user?.role === "admin";
}

export function canManageIntegrations(user: RoleCarrier) {
  return user?.role === "admin";
}

export function canManageUsers(user: RoleCarrier) {
  return user?.role === "admin";
}

export function canSelfEditUserProfile(user: RoleCarrier) {
  return user?.role === "admin" || user?.role === "editor";
}

export function isReadOnlyAdminUser(user: RoleCarrier) {
  return user?.role === "viewer";
}
