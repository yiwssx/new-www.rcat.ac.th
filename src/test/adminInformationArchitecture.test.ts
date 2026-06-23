import { describe, expect, it } from "vitest";
import usersPageSource from "../admin/pages/UsersPage.tsx?raw";
import settingsPageSource from "../admin/pages/SettingsPage.tsx?raw";
import integrationsPageSource from "../admin/pages/IntegrationsPage.tsx?raw";
import cmsShellSource from "../admin/layout/CmsShell.tsx?raw";
import routesSource from "../routes.tsx?raw";
import publicShellSource from "../public/components/PublicSiteShell.tsx?raw";

describe("M20 admin information architecture", () => {
  it("moves user management to an admin-only users route and sidebar item", () => {
    expect(usersPageSource).toContain("<UserManagementCard />");
    expect(usersPageSource).toContain("เพิ่ม แก้ไข ปิดใช้งาน และลบบัญชีผู้ใช้ระบบจัดการเว็บไซต์");
    expect(settingsPageSource).not.toContain("<UserManagementCard />");
    expect(cmsShellSource).toContain('label: "ผู้ใช้"');
    expect(cmsShellSource).toContain('to: "/admin/users"');
    expect(routesSource).toMatch(/path:\s*"users"[\s\S]*?<AdminOnlyPage>[\s\S]*?<UsersPage\s*\/>/);
  });

  it("describes the proxy media bridge without a browser VITE Apps Script warning", () => {
    expect(integrationsPageSource).toContain("เชื่อมต่อผ่าน Vercel Apps Script Proxy");
    expect(integrationsPageSource).toContain("Cloudflare");
    expect(integrationsPageSource).not.toContain("VITE_GOOGLE_APPS_SCRIPT_URL");
    expect(settingsPageSource).not.toContain("production auth requires Apps Script");
  });

  it("keeps mourning mode public-only and persists it through the existing site settings save path", () => {
    expect(settingsPageSource).toContain("checked={siteSettings.mourningModeEnabled}");
    expect(settingsPageSource).toContain('handleSiteSettingsChange("mourningModeNotice"');
    expect(settingsPageSource).toContain("saveSiteSettingsMutation.mutateAsync");
    expect(publicShellSource).toContain("rcat-mourning-mode");
    expect(cmsShellSource).not.toContain("rcat-mourning-mode");
  });
});
