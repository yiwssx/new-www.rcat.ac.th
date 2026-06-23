import { describe, expect, it } from "vitest";
import {
  defaultSiteSettings,
  extractIframeSrc,
  legacyDefaultMapUrl,
  normalizeSiteSettings
} from "../services/siteSettings";

describe("siteSettings", () => {
  const driveFileId = "RCAT_director-2026_ABC123";
  const canonicalDriveThumbnail = `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1200`;

  it("returns safe defaults for missing settings", () => {
    const settings = normalizeSiteSettings(null);

    expect(settings.siteName).toBe(defaultSiteSettings.siteName);
    expect(settings.heroTitle).toBe(defaultSiteSettings.siteName);
    expect(settings.footerTitle).toBe(defaultSiteSettings.siteName);
    expect(settings.facebookUrl).toBe("");
    expect(settings.heroImageUrl).toBe("");
    expect(settings.directorImageUrl).toBe("");
    expect(settings.mapUrl).toBe("");
    expect(settings.mapEmbedUrl).toBe("");
    expect(settings.footerDirectoryGroups).toEqual([]);
    expect(settings.messengerUrl).toBe("");
    expect(settings.messengerLabel).toBe("แชทกับเจ้าหน้าที่");
    expect(settings.messengerEnabled).toBe(false);
    expect(settings.mourningModeEnabled).toBe(false);
    expect(settings.mourningModeLabel).toBe("โหมดไว้อาลัย");
    expect(settings.mourningModeNotice).toBe("");
  });

  it("normalizes public mourning mode settings", () => {
    const settings = normalizeSiteSettings({
      mourningModeEnabled: true,
      mourningModeLabel: " ไว้อาลัย ",
      mourningModeNotice: " ร่วมแสดงความอาลัย "
    });

    expect(settings.mourningModeEnabled).toBe(true);
    expect(settings.mourningModeLabel).toBe("ไว้อาลัย");
    expect(settings.mourningModeNotice).toBe("ร่วมแสดงความอาลัย");
  });

  it("normalizes footer directory groups and Messenger settings", () => {
    const settings = normalizeSiteSettings({
      footerDirectoryGroups: [
        {
          title: " ลิงก์สำคัญ ",
          links: [
            { label: " ติดต่อเรา ", href: " /contact ", enabled: true },
            { label: " ปิดไว้ ", href: " https://school.example.edu ", enabled: false }
          ]
        },
        {
          title: "",
          links: []
        }
      ],
      messengerUrl: " https://m.me/rcat ",
      messengerLabel: " สอบถามข้อมูล ",
      messengerEnabled: true
    });

    expect(settings.footerDirectoryGroups).toEqual([
      {
        title: "ลิงก์สำคัญ",
        links: [
          { label: "ติดต่อเรา", href: "/contact", enabled: true },
          { label: "ปิดไว้", href: "https://school.example.edu", enabled: false }
        ]
      }
    ]);
    expect(settings.messengerUrl).toBe("https://m.me/rcat");
    expect(settings.messengerLabel).toBe("สอบถามข้อมูล");
    expect(settings.messengerEnabled).toBe(true);
  });

  it("clears unsafe public URLs and keeps allowed map URLs", () => {
    const settings = normalizeSiteSettings({
      facebookUrl: "javascript:alert(1)",
      youtubeUrl: "http://youtube.com/example",
      tiktokUrl: "data:text/html,test",
      heroImageUrl: "https://example.edu/hero.jpg",
      directorImageUrl: "https://example.edu/director.jpg",
      mapUrl: "https://maps.app.goo.gl/realCampusMap123",
      mapEmbedUrl: "https://www.google.com/maps/embed?pb=test"
    });

    expect(settings.facebookUrl).toBe("");
    expect(settings.youtubeUrl).toBe("");
    expect(settings.tiktokUrl).toBe("");
    expect(settings.heroImageUrl).toBe("https://example.edu/hero.jpg");
    expect(settings.directorImageUrl).toBe("https://example.edu/director.jpg");
    expect(settings.mapUrl).toBe("https://maps.app.goo.gl/realCampusMap123");
    expect(settings.mapEmbedUrl).toBe("https://www.google.com/maps/embed?pb=test");
  });

  it("cleans the legacy default map URL to an empty value", () => {
    const settings = normalizeSiteSettings({
      mapUrl: legacyDefaultMapUrl
    });

    expect(settings.mapUrl).toBe("");
  });

  it("normalizes Google Drive director image share URLs to thumbnail URLs", () => {
    const filePathSettings = normalizeSiteSettings({
      directorImageUrl: `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`
    });
    const openSettings = normalizeSiteSettings({
      directorImageUrl: `https://drive.google.com/open?id=${driveFileId}`
    });
    const ucSettings = normalizeSiteSettings({
      directorImageUrl: `https://drive.google.com/uc?id=${driveFileId}`
    });
    const thumbnailSettings = normalizeSiteSettings({
      directorImageUrl: `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w400`
    });

    expect(filePathSettings.directorImageUrl).toBe(canonicalDriveThumbnail);
    expect(openSettings.directorImageUrl).toBe(canonicalDriveThumbnail);
    expect(ucSettings.directorImageUrl).toBe(canonicalDriveThumbnail);
    expect(thumbnailSettings.directorImageUrl).toBe(canonicalDriveThumbnail);
  });

  it("keeps non-Google HTTPS director image URLs and rejects unsafe Google Drive IDs", () => {
    const httpsSettings = normalizeSiteSettings({
      directorImageUrl: "https://example.edu/director.jpg"
    });
    const unsafeDriveSettings = normalizeSiteSettings({
      directorImageUrl: "https://drive.google.com/file/d/unsafe$file/view?usp=sharing"
    });

    expect(httpsSettings.directorImageUrl).toBe("https://example.edu/director.jpg");
    expect(unsafeDriveSettings.directorImageUrl).toBe("");
  });

  it("does not apply Google Drive image normalization to map fields", () => {
    const settings = normalizeSiteSettings({
      mapUrl: `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`,
      mapEmbedUrl: `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1200`
    });

    expect(settings.mapUrl).toBe("");
    expect(settings.mapEmbedUrl).toBe("");
  });

  it("extracts a safe Google Maps embed URL from iframe input", () => {
    const settings = normalizeSiteSettings({
      mapEmbedUrl: '<iframe src="https://www.google.com/maps/embed?pb=test&amp;z=15" width="600"></iframe>'
    });

    expect(extractIframeSrc("<iframe src='https://www.google.com/maps/embed?pb=single'></iframe>")).toBe(
      "https://www.google.com/maps/embed?pb=single"
    );
    expect(settings.mapEmbedUrl).toBe("https://www.google.com/maps/embed?pb=test&z=15");
  });

  it("allows Google Maps short links only for mapUrl, not mapEmbedUrl", () => {
    const settings = normalizeSiteSettings({
      mapUrl: "https://maps.app.goo.gl/realCampusMap123",
      mapEmbedUrl: "https://maps.app.goo.gl/realCampusMap123"
    });

    expect(settings.mapUrl).toBe("https://maps.app.goo.gl/realCampusMap123");
    expect(settings.mapEmbedUrl).toBe("");
  });

  it("rejects unsafe iframe src values for mapEmbedUrl", () => {
    const settings = normalizeSiteSettings({
      mapEmbedUrl: '<iframe src="https://evil.com/maps/embed?pb=test"></iframe>'
    });
    const scriptSettings = normalizeSiteSettings({
      mapEmbedUrl: "javascript:alert(1)"
    });

    expect(settings.mapEmbedUrl).toBe("");
    expect(scriptSettings.mapEmbedUrl).toBe("");
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
