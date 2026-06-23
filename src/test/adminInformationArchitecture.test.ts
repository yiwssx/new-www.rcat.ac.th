import { describe, expect, it } from "vitest";
import usersPageSource from "../admin/pages/UsersPage.tsx?raw";
import settingsPageSource from "../admin/pages/SettingsPage.tsx?raw";
import integrationsPageSource from "../admin/pages/IntegrationsPage.tsx?raw";
import cmsShellSource from "../admin/layout/CmsShell.tsx?raw";
import routesSource from "../routes.tsx?raw";
import publicShellSource from "../public/components/PublicSiteShell.tsx?raw";
import siteViewApiSource from "../features/site-view/api.ts?raw";
import cloudflarePublicApiSource from "../features/public-read/cloudflareApi.ts?raw";
import adminCloudflareApiSource from "../features/admin-write/cloudflareApi.ts?raw";
import mediaBridgeClientSource from "../features/cms-media/mediaBridgeClient.ts?raw";

const nodeFsSpecifier = "node:fs";
const nodePathSpecifier = "node:path";
const { readFileSync } = (await import(/* @vite-ignore */ nodeFsSpecifier)) as {
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

  it("keeps public analytics and Cloudflare admin structured writes off direct Apps Script imports", () => {
    expect(siteViewApiSource).not.toContain("services/googleApi");
    expect(cloudflarePublicApiSource).not.toContain("services/googleApi");
    expect(adminCloudflareApiSource).not.toContain("services/googleApi");
    expect(mediaBridgeClientSource).toContain('const mediaBridgePath = "/api/apps-script-proxy"');
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
    expect(stylesSource).toContain("outline: 3px solid #111");
  });
});
