import { describe, expect, it } from "vitest";
import usersPageSource from "../admin/pages/UsersPage.tsx?raw";
import backupPageSource from "../admin/pages/BackupPage.tsx?raw";
import userManagementCardSource from "../admin/components/UserManagementCard.tsx?raw";
import settingsPageSource from "../admin/pages/SettingsPage.tsx?raw";
import integrationsPageSource from "../admin/pages/IntegrationsPage.tsx?raw";
import cmsShellSource from "../admin/layout/CmsShell.tsx?raw";
import routesSource from "../routes.tsx?raw";
import routeComponentsSource from "../routeComponents.tsx?raw";
import publicShellSource from "../public/components/PublicSiteShell.tsx?raw";
import siteViewApiSource from "../features/site-view/api.ts?raw";
import publicHomeApiSource from "../features/public-home/api.ts?raw";
import publicContentApiSource from "../features/public-content/api.ts?raw";
import publicDocumentsApiSource from "../features/public-documents/api.ts?raw";
import publicProgramsApiSource from "../features/public-programs/api.ts?raw";
import publicSearchApiSource from "../features/public-search/api.ts?raw";
import publicCmsSnapshotHookSource from "../public/hooks/usePublicCmsSnapshot.ts?raw";
import cmsDashboardApiSource from "../features/cms-dashboard/api.ts?raw";
import cmsContentApiSource from "../features/cms-content/api.ts?raw";
import cmsDocumentsApiSource from "../features/cms-documents/api.ts?raw";
import cmsCarouselApiSource from "../features/cms-carousel/api.ts?raw";
import cmsExternalServicesApiSource from "../features/cms-external-services/api.ts?raw";
import cmsEventsApiSource from "../features/cms-events/api.ts?raw";
import cmsSettingsApiSource from "../features/cms-settings/api.ts?raw";
import cmsNavigationApiSource from "../features/cms-navigation/api.ts?raw";
import cmsMediaApiSource from "../features/cms-media/api.ts?raw";
import cloudflarePublicApiSource from "../features/public-read/cloudflareApi.ts?raw";
import adminCloudflareApiSource from "../features/admin-write/cloudflareApi.ts?raw";
import mediaBridgeClientSource from "../features/cms-media/mediaBridgeClient.ts?raw";
import projectSettings from "../config/project-settings.json";

const browserStructuredDataSources = {
  publicHomeApiSource,
  publicContentApiSource,
  publicDocumentsApiSource,
  publicProgramsApiSource,
  publicSearchApiSource,
  publicCmsSnapshotHookSource,
  cmsDashboardApiSource,
  cmsContentApiSource,
  cmsDocumentsApiSource,
  cmsCarouselApiSource,
  cmsExternalServicesApiSource,
  cmsEventsApiSource,
  cmsSettingsApiSource,
  cmsNavigationApiSource,
  cmsMediaApiSource
};

const nodeFsSpecifier = "node:fs";
const nodePathSpecifier = "node:path";
const { existsSync, readFileSync } = (await import(/* @vite-ignore */ nodeFsSpecifier)) as {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: string) => string;
};
const { join } = (await import(/* @vite-ignore */ nodePathSpecifier)) as {
  join: (...paths: string[]) => string;
};
const runtimeProcess = (globalThis as { process?: { cwd: () => string } }).process;

if (!runtimeProcess) {
  throw new Error("Node process is required for source guardrail tests.");
}

const stylesSource = readFileSync(join(runtimeProcess.cwd(), "src/styles.css"), "utf8");

function extractCssRule(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stylesSource.match(new RegExp(`${escapedSelector}\\s*\\{(?<body>[\\s\\S]*?)\\n\\s*\\}`));

  return match?.groups?.body ?? "";
}

describe("M20 admin information architecture", () => {
  it("moves CMS user lifecycle management to a capability-guarded users route and sidebar item", () => {
    expect(usersPageSource).toContain("<UserManagementCard />");
    expect(usersPageSource).toContain("ผู้ใช้และสิทธิ์การเข้าถึง");
    expect(usersPageSource).not.toContain("getGoogleAppsScriptUrl");
    expect(usersPageSource).not.toContain("Legacy user management");
    expect(userManagementCardSource).toContain("useAdminUserListQuery");
    expect(userManagementCardSource).toContain("createAdminUserWithInvitationToCloudflare");
    expect(userManagementCardSource).toContain("saveAdminUserProfileToCloudflare");
    expect(userManagementCardSource).toContain("deleteAdminUserProfileFromCloudflare");
    expect(adminCloudflareApiSource).toContain("/api/admin/users");
    expect(userManagementCardSource).not.toContain("getUserAccounts");
    expect(userManagementCardSource).not.toContain("saveUserAccount");
    expect(userManagementCardSource).not.toContain("deleteUserAccount");
    expect(userManagementCardSource).not.toContain("resetUserAccounts");
    expect(userManagementCardSource).not.toContain('type="password"');
    expect(settingsPageSource).not.toContain("<UserManagementCard />");
    expect(cmsShellSource).toContain('label: "ผู้ใช้งาน"');
    expect(cmsShellSource).toContain('to: "/admin/users"');
    expect(routesSource).toMatch(
      /path:\s*"users"[\s\S]*?<CapabilityGuard capability="users\.read-all">[\s\S]*?<UsersPage/
    );
    expect(routesSource).not.toMatch(/path:\s*"users"[\s\S]*?<AdminOnlyPage>[\s\S]*?<UsersPage\s*\/>/);
  });

  it("adds an admin-only D1 backup route and sidebar item without restore controls", () => {
    expect(backupPageSource).toContain("สำรองข้อมูลระบบ");
    expect(backupPageSource).toContain("ตรวจนับข้อมูล");
    expect(backupPageSource).toContain("ดาวน์โหลดไฟล์สำรองข้อมูล");
    expect(backupPageSource).toContain("canReadSystemBackupCounts");
    expect(backupPageSource).toContain("canDownloadSystemBackup");
    expect(backupPageSource).toContain("downloadD1BackupFromCloudflare");
    expect(backupPageSource).toContain("getD1BackupCountsFromCloudflare");
    expect(backupPageSource).not.toMatch(/restore|นำเข้า|อัปโหลดไฟล์สำรอง/i);
    expect(cmsShellSource).toContain('label: "สำรองข้อมูล"');
    expect(cmsShellSource).toContain('to: "/admin/backup"');
    expect(routeComponentsSource).toContain('export const BackupPage = lazy(() => import("./admin/pages/BackupPage"))');
    expect(routesSource).toMatch(
      /path:\s*"backup"[\s\S]*?<CapabilityGuard anyOf=\{\["backup\.counts", "backup\.download"\]\}>[\s\S]*?<BackupPage/
    );
  });

  it("uses server-issued capabilities for admin navigation and mutation controls", () => {
    expect(cmsShellSource).toContain("hasAnyCmsCapability");
    expect(cmsShellSource).toContain("capabilities");
    expect(userManagementCardSource).toContain('hasCapability("users.create")');
    expect(userManagementCardSource).toContain('hasCapability("users.update-any")');
    expect(userManagementCardSource).toContain('hasCapability("users.delete")');
    expect(settingsPageSource).toContain("canManageAdminData");
    expect(cmsShellSource).not.toContain('session?.user.role === "admin"');
    expect(routesSource).toMatch(
      /path:\s*"settings"[\s\S]*?<CapabilityGuard capability="settings\.read">[\s\S]*?<SettingsPage/
    );
    expect(routesSource).toMatch(/path:\s*"menus"[\s\S]*?<CapabilityGuard capability="menu\.read">[\s\S]*?<MenuPage/);
    expect(routesSource).not.toMatch(/path:\s*"settings"[\s\S]*?<AdminOnlyPage>[\s\S]*?<SettingsPage\s*\/>/);
  });

  it("describes the proxy media bridge without a browser VITE Apps Script warning", () => {
    expect(integrationsPageSource).toContain("เชื่อมต่อผ่าน Vercel Apps Script Proxy");
    expect(integrationsPageSource).toContain("Cloudflare");
    expect(integrationsPageSource).not.toContain("VITE_GOOGLE_APPS_SCRIPT_URL");
    expect(settingsPageSource).not.toContain("production auth requires Apps Script");
  });

  it("keeps public analytics and Cloudflare admin structured writes off direct Apps Script imports", () => {
    expect(siteViewApiSource).not.toContain("services/googleApi");
    expect(cloudflarePublicApiSource).not.toContain("services/googleApi");
    expect(adminCloudflareApiSource).not.toContain("services/googleApi");
    expect(mediaBridgeClientSource).toContain('const mediaBridgePath = "/api/apps-script-proxy"');
  });

  it("keeps active browser structured data off the legacy Apps Script adapter", () => {
    Object.entries(browserStructuredDataSources).forEach(([sourceName, source]) => {
      expect(source, sourceName).not.toContain("services/googleApi");
      expect(source, sourceName).not.toContain("getGoogleAppsScriptUrl");
      expect(source, sourceName).not.toContain("VITE_GOOGLE_APPS_SCRIPT_URL");
      expect(source, sourceName).not.toContain("FromAppsScript");
    });

    expect(projectSettings).not.toHaveProperty("api");
  });

  it("removes the no-op admin action progress surface", () => {
    expect(routeComponentsSource).not.toContain("AdminActionProgress");
    expect(existsSync(join(runtimeProcess.cwd(), "src/admin/components/AdminActionProgress.tsx"))).toBe(false);
    expect(existsSync(join(runtimeProcess.cwd(), "src/shared/api/activity.ts"))).toBe(false);
  });

  it("keeps mourning mode public-only and persists it through the existing site settings save path", () => {
    expect(settingsPageSource).toContain("checked={siteSettings.mourningModeEnabled}");
    expect(settingsPageSource).toContain('handleSiteSettingsChange("mourningModeNotice"');
    expect(settingsPageSource).toContain("saveSiteSettingsMutation.mutateAsync");
    expect(settingsPageSource).toContain("invalidatePublicCmsData");
    expect(settingsPageSource).toContain("invalidatePublicCmsData(queryClient)");
    expect(publicShellSource).toContain("rcat-mourning-mode");
    expect(cmsShellSource).not.toContain("rcat-mourning-mode");
  });

  it("scopes simple full-page grayscale mourning styles to the public shell only", () => {
    const mourningRootRule = extractCssRule(".rcat-page.rcat-mourning-mode");

    expect(stylesSource).toContain(".rcat-page.rcat-mourning-mode");
    expect(stylesSource).not.toContain("body.rcat-mourning-mode");
    expect(stylesSource).not.toContain("html.rcat-mourning-mode");
    expect(mourningRootRule).toContain("filter: grayscale(100%) contrast(105%)");
    expect(mourningRootRule).toContain("transition: filter 0.25s ease-in-out");

    [
      "--rcat-mourning-bg",
      "--rcat-mourning-surface",
      "--rcat-mourning-inverse-bg",
      ".MuiButton-root",
      ".MuiSvgIcon-root",
      ".MuiIconButton-root",
      ".MuiPaper-root",
      ".MuiCard-root"
    ].forEach((unexpectedRule) => {
      expect(stylesSource).not.toContain(unexpectedRule);
    });

    expect(stylesSource).not.toContain("filter: none");
    expect(stylesSource).toContain(".rcat-page.rcat-mourning-mode :focus-visible");
    expect(stylesSource).toContain("outline: 2px solid transparent");
    expect(stylesSource).toContain("box-shadow: var(--rcat-focus-ring-shadow)");
  });
});
