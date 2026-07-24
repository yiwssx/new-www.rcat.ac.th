import { hasAnyCmsCapability, hasCmsCapability, type CmsCapability } from "../../features/cms-auth";

export const ADMIN_READ_ONLY_NOTICE =
  "บัญชีนี้มีสิทธิ์อ่านข้อมูลเท่านั้น ระบบจะซ่อนหรือปิดการควบคุมที่ต้องใช้สิทธิ์แก้ไข";

type CapabilityCarrier = readonly CmsCapability[] | ReadonlySet<CmsCapability> | null | undefined;

export function canReadAdminData(capabilities: CapabilityCarrier) {
  return hasAnyCmsCapability(capabilities, [
    "dashboard.read",
    "content.read",
    "documents.read",
    "media.read",
    "events.read",
    "carousel.read",
    "external-services.read",
    "menu.read",
    "settings.read",
    "users.read-self"
  ]);
}

export function canManageAdminData(capabilities: CapabilityCarrier) {
  return hasCmsCapability(capabilities, "settings.manage");
}

export function canManageContent(capabilities: CapabilityCarrier) {
  return hasAnyCmsCapability(capabilities, ["content.create", "content.update", "content.delete", "content.publish"]);
}

export function canPublishContent(capabilities: CapabilityCarrier) {
  return hasCmsCapability(capabilities, "content.publish");
}

export function canManageDocuments(capabilities: CapabilityCarrier) {
  return hasAnyCmsCapability(capabilities, [
    "documents.create",
    "documents.update",
    "documents.delete",
    "documents.publish"
  ]);
}

export function canManageMedia(capabilities: CapabilityCarrier) {
  return hasCmsCapability(capabilities, "media.manage");
}

export function canManageEvents(capabilities: CapabilityCarrier) {
  return hasCmsCapability(capabilities, "events.manage");
}

export function canManageCarousel(capabilities: CapabilityCarrier) {
  return hasCmsCapability(capabilities, "carousel.manage");
}

export function canManageExternalServices(capabilities: CapabilityCarrier) {
  return hasCmsCapability(capabilities, "external-services.manage");
}

export function canManageWebsiteSettings(capabilities: CapabilityCarrier) {
  return hasCmsCapability(capabilities, "settings.manage");
}

export function canManageMenu(capabilities: CapabilityCarrier) {
  return hasCmsCapability(capabilities, "menu.manage");
}

export function canManageIntegrations(capabilities: CapabilityCarrier) {
  return hasCmsCapability(capabilities, "media.manage");
}

export function canManageUsers(capabilities: CapabilityCarrier) {
  return hasCmsCapability(capabilities, "users.update-any");
}

export function canManageSystemBackup(capabilities: CapabilityCarrier) {
  return canReadSystemBackupCounts(capabilities) || canDownloadSystemBackup(capabilities);
}

export function canReadSystemBackupCounts(capabilities: CapabilityCarrier) {
  return hasCmsCapability(capabilities, "backup.counts");
}

export function canDownloadSystemBackup(capabilities: CapabilityCarrier) {
  return hasCmsCapability(capabilities, "backup.download");
}

export function canSelfEditUserProfile(capabilities: CapabilityCarrier) {
  return hasCmsCapability(capabilities, "users.update-self");
}

export function isReadOnlyAdminUser(capabilities: CapabilityCarrier) {
  return !hasAnyCmsCapability(capabilities, [
    "content.create",
    "content.update",
    "content.delete",
    "content.publish",
    "documents.create",
    "documents.update",
    "documents.delete",
    "documents.publish",
    "media.manage",
    "events.manage",
    "carousel.manage",
    "external-services.manage",
    "menu.manage",
    "settings.manage",
    "users.update-any"
  ]);
}
