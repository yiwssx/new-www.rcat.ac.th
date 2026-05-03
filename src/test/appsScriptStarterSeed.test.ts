import { describe, expect, it, vi, type Mock } from "vitest";
import siteSettingsSource from "../../apps-script/SiteSettings.gs?raw";

interface SeedContext {
  getSheetSettingValue: Mock;
  invalidatePublicSnapshotCache: Mock;
  menuSetValues: Mock;
  normalizeSiteSettings: (input: Record<string, unknown>, options?: { validate?: boolean }) => Record<string, string>;
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

function normalizePublicMediaUrl(url: string, allowedHosts?: string[]) {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw createHttpError("Invalid public URL.", 400);
  }

  if (parsed.protocol !== "https:") {
    throw createHttpError("Public URL must use https.", 400);
  }

  if (allowedHosts?.length && !allowedHosts.includes(parsed.hostname.toLowerCase())) {
    throw createHttpError("Public media preview/embed URL host is not allowed.", 400);
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
  normalizeSiteSettings,
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
  ) as Pick<SeedContext, "normalizeSiteSettings" | "seedStarterPublicSiteSettings" | "smokeTestSiteSettings">;

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
      heroImageUrl: "",
      directorImageUrl: "",
      mapUrl: "https://maps.app.goo.gl/yhCsgrkLgd1pekM28",
      mapEmbedUrl: ""
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

describe("Apps Script site settings normalization", () => {
  const driveFileId = "RCAT_director-2026_ABC123";
  const canonicalDriveThumbnail = `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1200`;

  it("accepts direct and iframe Google Maps embed URLs", () => {
    const context = loadSeedContext();
    const direct = context.normalizeSiteSettings({
      mapEmbedUrl: "https://www.google.com/maps/embed?pb=direct"
    });
    const iframe = context.normalizeSiteSettings({
      mapEmbedUrl: '<iframe width="600" src="https://www.google.com/maps/embed?pb=iframe&amp;z=15"></iframe>'
    });

    expect(direct.mapEmbedUrl).toBe("https://www.google.com/maps/embed?pb=direct");
    expect(iframe.mapEmbedUrl).toBe("https://www.google.com/maps/embed?pb=iframe&z=15");
  });

  it("normalizes Google Drive director image share URLs to thumbnail URLs", () => {
    const context = loadSeedContext();

    expect(
      context.normalizeSiteSettings({
        directorImageUrl: `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`
      }).directorImageUrl
    ).toBe(canonicalDriveThumbnail);
    expect(
      context.normalizeSiteSettings({
        directorImageUrl: `https://drive.google.com/open?id=${driveFileId}`
      }).directorImageUrl
    ).toBe(canonicalDriveThumbnail);
    expect(
      context.normalizeSiteSettings({
        directorImageUrl: `https://drive.google.com/uc?id=${driveFileId}`
      }).directorImageUrl
    ).toBe(canonicalDriveThumbnail);
    expect(
      context.normalizeSiteSettings({
        directorImageUrl: `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w400`
      }).directorImageUrl
    ).toBe(canonicalDriveThumbnail);
  });

  it("keeps non-Google director image URLs and rejects unsafe Google Drive IDs", () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const context = loadSeedContext();

      expect(
        context.normalizeSiteSettings({
          directorImageUrl: "https://example.edu/director.jpg"
        }).directorImageUrl
      ).toBe("https://example.edu/director.jpg");
      expect(
        context.normalizeSiteSettings({
          directorImageUrl: "https://drive.google.com/file/d/unsafe$file/view?usp=sharing"
        }).directorImageUrl
      ).toBe("");
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });

  it("does not apply Google Drive director image normalization to map fields", () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const context = loadSeedContext();
      const settings = context.normalizeSiteSettings({
        mapUrl: `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`,
        mapEmbedUrl: `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1200`
      });

      expect(settings.mapUrl).toBe("");
      expect(settings.mapEmbedUrl).toBe("");
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });

  it("allows Google Maps short links only as mapUrl", () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const context = loadSeedContext();
      const settings = context.normalizeSiteSettings({
        mapUrl: "https://maps.app.goo.gl/yhCsgrkLgd1pekM28",
        mapEmbedUrl: "https://maps.app.goo.gl/yhCsgrkLgd1pekM28"
      });

      expect(settings.mapUrl).toBe("https://maps.app.goo.gl/yhCsgrkLgd1pekM28");
      expect(settings.mapEmbedUrl).toBe("");
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });

  it("rejects unsafe iframe src values when validating admin saves", () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const context = loadSeedContext();
      const relaxed = context.normalizeSiteSettings({
        mapEmbedUrl: '<iframe src="https://evil.com/maps/embed?pb=test"></iframe>'
      });

      expect(relaxed.mapEmbedUrl).toBe("");
      expect(() =>
        context.normalizeSiteSettings(
          {
            mapEmbedUrl: '<iframe src="https://evil.com/maps/embed?pb=test"></iframe>'
          },
          {
            validate: true
          }
        )
      ).toThrow("mapEmbedUrl must be a Google Maps embed https URL or empty.");
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });
});
