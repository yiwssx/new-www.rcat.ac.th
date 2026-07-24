import { describe, expect, it } from "vitest";
import type { CmsCapability } from "../../features/cms-auth";
import {
  canDownloadSystemBackup,
  canManageAdminData,
  canManageContent,
  canManageIntegrations,
  canManageMedia,
  canManageMenu,
  canManageSystemBackup,
  canManageUsers,
  canManageWebsiteSettings,
  canPublishContent,
  canReadAdminData,
  canReadSystemBackupCounts,
  canSelfEditUserProfile,
  isReadOnlyAdminUser
} from "./rbac";

function capabilities(...values: CmsCapability[]) {
  return values;
}

describe("admin capability presentation helpers", () => {
  it("derives read access from server capabilities rather than a role", () => {
    expect(canReadAdminData(capabilities("dashboard.read"))).toBe(true);
    expect(canReadAdminData(capabilities("users.read-self"))).toBe(true);
    expect(canReadAdminData([])).toBe(false);
    expect(canReadAdminData(null)).toBe(false);
  });

  it("uses exact mutation capabilities", () => {
    expect(canManageAdminData(capabilities("settings.manage"))).toBe(true);
    expect(canManageAdminData(capabilities("settings.read"))).toBe(false);
    expect(canManageContent(capabilities("content.update"))).toBe(true);
    expect(canManageContent(capabilities("content.read"))).toBe(false);
    expect(canPublishContent(capabilities("content.publish"))).toBe(true);
    expect(canManageMedia(capabilities("media.manage"))).toBe(true);
  });

  it("keeps unrelated capability groups isolated", () => {
    expect(canManageWebsiteSettings(capabilities("settings.manage"))).toBe(true);
    expect(canManageMenu(capabilities("settings.manage"))).toBe(false);
    expect(canManageIntegrations(capabilities("media.manage"))).toBe(true);
    expect(canManageUsers(capabilities("users.update-any"))).toBe(true);
    expect(canManageSystemBackup(capabilities("backup.counts"))).toBe(true);
    expect(canReadSystemBackupCounts(capabilities("backup.counts"))).toBe(true);
    expect(canReadSystemBackupCounts(capabilities("backup.download"))).toBe(false);
    expect(canDownloadSystemBackup(capabilities("backup.download"))).toBe(true);
    expect(canDownloadSystemBackup(capabilities("backup.counts"))).toBe(false);
    expect(canSelfEditUserProfile(capabilities("users.update-self"))).toBe(true);
  });

  it("treats a capability set without mutations as read-only", () => {
    expect(isReadOnlyAdminUser(capabilities("dashboard.read", "content.read"))).toBe(true);
    expect(isReadOnlyAdminUser(capabilities("content.update"))).toBe(false);
  });
});
