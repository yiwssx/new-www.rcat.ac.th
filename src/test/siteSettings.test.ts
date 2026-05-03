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
    expect(settings.directorImageUrl).toBe("");
    expect(settings.mapUrl).toBe("https://maps.app.goo.gl/yhCsgrkLgd1pekM28");
    expect(settings.mapEmbedUrl).toBe("");
  });

  it("clears unsafe public URLs and keeps allowed map URLs", () => {
    const settings = normalizeSiteSettings({
      facebookUrl: "javascript:alert(1)",
      youtubeUrl: "http://youtube.com/example",
      tiktokUrl: "data:text/html,test",
      heroImageUrl: "https://example.edu/hero.jpg",
      directorImageUrl: "https://example.edu/director.jpg",
      mapUrl: "https://maps.app.goo.gl/yhCsgrkLgd1pekM28",
      mapEmbedUrl: "https://www.google.com/maps/embed?pb=test"
    });

    expect(settings.facebookUrl).toBe("");
    expect(settings.youtubeUrl).toBe("");
    expect(settings.tiktokUrl).toBe("");
    expect(settings.heroImageUrl).toBe("https://example.edu/hero.jpg");
    expect(settings.directorImageUrl).toBe("https://example.edu/director.jpg");
    expect(settings.mapUrl).toBe("https://maps.app.goo.gl/yhCsgrkLgd1pekM28");
    expect(settings.mapEmbedUrl).toBe("https://www.google.com/maps/embed?pb=test");
  });

  it("clears unsupported map URLs", () => {
    const settings = normalizeSiteSettings({
      mapUrl: "https://example.edu/map",
      mapEmbedUrl: "https://www.google.com/maps/place/example"
    });

    expect(settings.mapUrl).toBe("");
    expect(settings.mapEmbedUrl).toBe("");
  });
});
