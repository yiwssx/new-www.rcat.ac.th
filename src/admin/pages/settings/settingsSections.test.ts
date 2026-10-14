import { describe, expect, it } from "vitest";
import { defaultSiteSettings } from "../../../services/siteSettings";
import {
  buildScopedSiteSettingsPatch, isSiteSettingsCategory, settingsCategories,
  settingsNavigation, siteSettingsKeys
} from "./settingsSections";

describe("admin settings route partitions", () => {
  it("defines unique direct-link categories with a complete site-settings partition", () => {
    expect(settingsCategories).toHaveLength(7);
    expect(new Set(settingsNavigation.map((item) => item.id)).size).toBe(settingsCategories.length);
    expect(settingsNavigation.map((item) => item.id)).toEqual([...settingsCategories]);
    expect(isSiteSettingsCategory("homepage")).toBe(false);
    expect(isSiteSettingsCategory("leadership")).toBe(true);
    const keys = Object.values(siteSettingsKeys).flat();
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(keys)).toEqual(new Set(Object.keys(defaultSiteSettings)));
  });

  it("sends only changed fields for the active category, without clobbering other pages", () => {
    const baseline = { ...defaultSiteSettings, siteName: "Original" };
    const edited = { ...baseline, directorName: "New director", siteName: "Stale site title" };
    const latest = { ...baseline, siteName: "New title from other tab" };
    expect(buildScopedSiteSettingsPatch(baseline, edited, latest, "leadership"))
      .toEqual({ directorName: "New director" });
    expect(buildScopedSiteSettingsPatch(baseline, baseline, latest, "leadership"))
      .toEqual({});
  });

  it("rejects simultaneous edits to the same field", () => {
    const baseline = { ...defaultSiteSettings, siteName: "Before" };
    const edited = { ...baseline, siteName: "Editor one" };
    const latest = { ...baseline, siteName: "Editor two" };
    expect(() => buildScopedSiteSettingsPatch(baseline, edited, latest, "general"))
      .toThrow("ข้อมูลส่วนนี้ถูกแก้ไข");
    expect(buildScopedSiteSettingsPatch(baseline, edited, edited, "general"))
      .toEqual({ siteName: "Editor one" });
  });
});
