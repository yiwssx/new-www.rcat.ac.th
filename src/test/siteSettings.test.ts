import { describe, expect, it } from "vitest";
import { defaultSiteSettings, normalizeSiteSettings } from "../services/siteSettings";

describe("siteSettings", () => {
  it("returns safe defaults for missing settings", () => {
    const settings = normalizeSiteSettings(null);

    expect(settings.siteName).toBe(defaultSiteSettings.siteName);
    expect(settings.heroTitle).toBe(defaultSiteSettings.siteName);
    expect(settings.footerTitle).toBe(defaultSiteSettings.siteName);
    expect(settings.facebookUrl).toBe("");
    expect(settings.heroImageUrl).toBe("");
  });

  it("clears unsafe social and hero URLs", () => {
    const settings = normalizeSiteSettings({
      facebookUrl: "javascript:alert(1)",
      youtubeUrl: "http://youtube.com/example",
      tiktokUrl: "data:text/html,test",
      heroImageUrl: "https://example.edu/hero.jpg"
    });

    expect(settings.facebookUrl).toBe("");
    expect(settings.youtubeUrl).toBe("");
    expect(settings.tiktokUrl).toBe("");
    expect(settings.heroImageUrl).toBe("https://example.edu/hero.jpg");
  });
});
