import { describe, expect, it, vi, type Mock } from "vitest";
import siteSettingsSource from "../../apps-script/SiteSettings.gs?raw";

interface SeedContext {
  getSheetSettingValue: Mock;
  invalidatePublicSnapshotCache: Mock;
  menuSetValues: Mock;
  readObjects: Mock;
  seedStarterPublicSiteSettings: () => { siteSettingsSeeded: boolean; menuSeeded: boolean };
  smokeTestSiteSettings: () => { ok: boolean; siteName: string; heroTitle: string };
  upsertSetting: Mock;
}

function createHttpError(message: string, statusCode: number) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

function normalizePublicMediaUrl(url: string) {
  const parsed = new URL(url);

  if (parsed.protocol !== "https:") {
    throw createHttpError("Public URL must use https.", 400);
  }

  return url;
}

function loadSeedContext(input?: { rawSiteSettings?: string; existingMenuRows?: unknown[] }): SeedContext {
  const menuSetValues = vi.fn();
  const menuSheet = {
    getRange: vi.fn(() => ({
      setValues: menuSetValues
    }))
  };
  const settingsSheet = {};
  const spreadsheet = {};
  const getSpreadsheet = vi.fn(() => spreadsheet);
  const ensureSettingsSheet = vi.fn(() => settingsSheet);
  const getOrEnsureSettingsSheet = vi.fn(() => settingsSheet);
  const getSheetSettingValue = vi.fn(() => input?.rawSiteSettings || "");
  const upsertSetting = vi.fn();
  const ensureSheet = vi.fn(() => menuSheet);
  const readObjects = vi.fn(() => input?.existingMenuRows || []);
  const invalidatePublicSnapshotCache = vi.fn();
  const createScriptExports = new Function(
    "console",
    "getSpreadsheet",
    "ensureSettingsSheet",
    "getOrEnsureSettingsSheet",
    "getSheetSettingValue",
    "upsertSetting",
    "ensureSheet",
    "readObjects",
    "invalidatePublicSnapshotCache",
    "normalizePublicMediaUrl",
    "createHttpError",
    "SETTING_KEYS",
    "SHEETS",
    "MENU_HEADERS",
    `${siteSettingsSource}
return {
  seedStarterPublicSiteSettings,
  smokeTestSiteSettings
};`
  );
  const exports = createScriptExports(
    console,
    getSpreadsheet,
    ensureSettingsSheet,
    getOrEnsureSettingsSheet,
    getSheetSettingValue,
    upsertSetting,
    ensureSheet,
    readObjects,
    invalidatePublicSnapshotCache,
    normalizePublicMediaUrl,
    createHttpError,
    { siteSettings: "siteSettings" },
    { menu: "Menu" },
    ["id", "parentId", "labelTh", "href", "order", "enabled"]
  ) as Pick<SeedContext, "seedStarterPublicSiteSettings" | "smokeTestSiteSettings">;

  return {
    ...exports,
    getSheetSettingValue,
    invalidatePublicSnapshotCache,
    menuSetValues,
    readObjects,
    upsertSetting
  };
}

describe("Apps Script starter public seed", () => {
  it("seeds neutral site settings and minimal menu when both are empty", () => {
    const context = loadSeedContext();
    const result = context.seedStarterPublicSiteSettings();
    const [, key, rawValue] = context.upsertSetting.mock.calls[0];
    const siteSettings = JSON.parse(rawValue);

    expect(result).toEqual({
      siteSettingsSeeded: true,
      menuSeeded: true
    });
    expect(key).toBe("siteSettings");
    expect(siteSettings).toMatchObject({
      siteName: "เว็บไซต์สถานศึกษา",
      heroTitle: "เว็บไซต์สถานศึกษา",
      footerTitle: "เว็บไซต์สถานศึกษา",
      phone: "",
      email: "",
      address: "",
      heroImageUrl: ""
    });
    expect(context.menuSetValues).toHaveBeenCalledWith([
      ["starter-home", "", "หน้าแรก", "/", 0, "TRUE"],
      ["starter-news", "", "ข่าวสาร", "/news", 1, "TRUE"],
      ["starter-announcements", "", "ประกาศ", "/announcements", 2, "TRUE"],
      ["starter-departments", "", "หลักสูตร", "/departments", 3, "TRUE"],
      ["starter-contact", "", "ติดต่อ", "/contact", 4, "TRUE"]
    ]);
    expect(context.invalidatePublicSnapshotCache).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite existing production site settings or menu rows", () => {
    const context = loadSeedContext({
      rawSiteSettings: JSON.stringify({ siteName: "Existing school" }),
      existingMenuRows: [{ id: "existing-home" }]
    });

    const result = context.seedStarterPublicSiteSettings();

    expect(result).toEqual({
      siteSettingsSeeded: false,
      menuSeeded: false
    });
    expect(context.upsertSetting).not.toHaveBeenCalled();
    expect(context.menuSetValues).not.toHaveBeenCalled();
    expect(context.invalidatePublicSnapshotCache).not.toHaveBeenCalled();
  });

  it("smoke tests reading and updating site settings", () => {
    const context = loadSeedContext();
    const result = context.smokeTestSiteSettings();
    const [, key, rawValue] = context.upsertSetting.mock.calls[0];
    const siteSettings = JSON.parse(rawValue);

    expect(result).toEqual({
      ok: true,
      siteName: "เว็บไซต์สถานศึกษา",
      heroTitle: "เว็บไซต์สถานศึกษา"
    });
    expect(key).toBe("siteSettings");
    expect(siteSettings.siteName).toBe("เว็บไซต์สถานศึกษา");
    expect(siteSettings.heroTitle).toBe("เว็บไซต์สถานศึกษา");
  });
});
