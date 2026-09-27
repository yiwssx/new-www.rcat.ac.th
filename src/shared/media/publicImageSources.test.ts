import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_IMAGE_POLICIES,
  buildGoogleDriveThumbnailUrl,
  buildPublicImageDeliveryUrl,
  extractGoogleDriveFileId,
  getPublicImageDeliveryVariantUrls,
  getPublicImageIntentPolicy,
  isPublicImageDeliveryEnabled,
  normalizePublicImageWidths,
  resolvePublicImageFallbackSource,
  resolvePublicImageSource,
  selectPublicImageSource
} from "./publicImageSources";

const driveFileId = "RCAT_media-2026_ABC123";
const driveFileUrl = `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`;
const driveThumbnailUrl = `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w400`;
const workerBaseUrl = "https://rcat-image-test.rcat-digital.workers.dev";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("publicImageSources", () => {
  it("extracts valid Drive IDs from file and thumbnail URL forms", () => {
    expect(extractGoogleDriveFileId(driveFileUrl)).toBe(driveFileId);
    expect(extractGoogleDriveFileId(driveThumbnailUrl)).toBe(driveFileId);
    expect(extractGoogleDriveFileId(`https://drive.google.com/open?id=${driveFileId}`)).toBe(driveFileId);
    expect(extractGoogleDriveFileId("https://example.edu/image.jpg")).toBe("");
  });

  it("builds only valid, bounded Drive thumbnail URLs", () => {
    expect(buildGoogleDriveThumbnailUrl(driveFileId, 320)).toBe(
      `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w320`
    );
    expect(buildGoogleDriveThumbnailUrl("unsafe$id", 320)).toBe("");
    expect(buildGoogleDriveThumbnailUrl(driveFileId, 0)).toBe("");
    expect(buildGoogleDriveThumbnailUrl(driveFileId, 1601)).toBe("");
  });

  it("builds only valid HTTPS Worker delivery URLs", () => {
    expect(buildPublicImageDeliveryUrl(driveFileId, 384, workerBaseUrl)).toBe(
      `${workerBaseUrl}/image/${driveFileId}?w=384`
    );
    expect(buildPublicImageDeliveryUrl("unsafe$id", 384, workerBaseUrl)).toBe("");
    expect(buildPublicImageDeliveryUrl(driveFileId, 1601, workerBaseUrl)).toBe("");
    expect(buildPublicImageDeliveryUrl(driveFileId, 384, "http://example.com")).toBe("");
  });

  it("normalizes, sorts, and deduplicates width candidates", () => {
    expect(normalizePublicImageWidths([640, -1, 240, 640, 0, 1601, 320])).toEqual([240, 320, 640]);
  });

  it("uses intent-specific fallback widths and responsive candidates", () => {
    const regularCard = resolvePublicImageSource(driveFileUrl, "content-card");
    const featuredCard = resolvePublicImageSource(driveFileUrl, "featured-card");
    const portrait = resolvePublicImageSource(driveFileUrl, "portrait");

    expect(regularCard.src).toContain("sz=w320");
    expect(regularCard.widths).toEqual([160, 240, 320, 480, 640]);
    expect(featuredCard.src).toContain("sz=w640");
    expect(featuredCard.widths).toEqual([320, 480, 640, 900]);
    expect(portrait.src).toContain("sz=w384");
    expect(portrait.widths).toEqual([192, 256, 384, 512]);
  });

  it("routes only configured intents through the Worker and exposes Drive fallback", () => {
    vi.stubEnv("VITE_PUBLIC_IMAGE_DELIVERY_BASE_URL", workerBaseUrl);
    vi.stubEnv("VITE_PUBLIC_IMAGE_DELIVERY_INTENTS", "portrait,carousel,intro-gate");

    expect(isPublicImageDeliveryEnabled("portrait")).toBe(true);
    expect(isPublicImageDeliveryEnabled("content-card")).toBe(false);

    const portrait = resolvePublicImageSource(driveFileUrl, "portrait");
    const portraitFallback = resolvePublicImageFallbackSource(driveFileUrl, "portrait");
    const card = resolvePublicImageSource(driveFileUrl, "content-card");

    expect(portrait.src).toBe(`${workerBaseUrl}/image/${driveFileId}?w=384`);
    expect(portrait.srcSet).toContain(`${workerBaseUrl}/image/${driveFileId}?w=192 192w`);
    expect(portraitFallback.src).toBe(`https://drive.google.com/thumbnail?id=${driveFileId}&sz=w384`);
    expect(card.src).toBe(`https://drive.google.com/thumbnail?id=${driveFileId}&sz=w320`);
    expect(getPublicImageDeliveryVariantUrls(driveFileUrl, "portrait")).toHaveLength(4);
    expect(getPublicImageDeliveryVariantUrls(driveFileUrl, "content-card")).toEqual([]);
  });

  it("supports an all-intents rollout switch", () => {
    vi.stubEnv("VITE_PUBLIC_IMAGE_DELIVERY_BASE_URL", workerBaseUrl);
    vi.stubEnv("VITE_PUBLIC_IMAGE_DELIVERY_INTENTS", "*");

    expect(isPublicImageDeliveryEnabled("logo")).toBe(true);
    expect(isPublicImageDeliveryEnabled("content-body")).toBe(true);
    expect(resolvePublicImageSource(driveFileUrl, "content-body").src).toContain(workerBaseUrl);
  });

  it("keeps every declared policy sorted, unique, positive, and bounded", () => {
    for (const intent of Object.keys(PUBLIC_IMAGE_POLICIES) as Array<keyof typeof PUBLIC_IMAGE_POLICIES>) {
      const policy = getPublicImageIntentPolicy(intent);

      expect(policy.widths.length).toBeGreaterThan(0);
      expect(policy.widths).toEqual([...new Set(policy.widths)].sort((left, right) => left - right));
      expect(policy.widths.every((width) => width > 0 && width <= 1600)).toBe(true);
      expect(policy.widths).toContain(policy.fallbackWidth);
    }
  });

  it("prefers thumbnail media for small slots and preview media for large slots", () => {
    const asset = {
      type: "image",
      thumbnailUrl: `https://drive.google.com/file/d/RCAT_thumbnail_ABC123/view`,
      previewUrl: `https://drive.google.com/file/d/RCAT_preview_ABC123/view`,
      driveUrl: `https://drive.google.com/file/d/RCAT_drive_ABC123/view`
    };

    expect(selectPublicImageSource(asset, "content-card")).toBe(asset.thumbnailUrl);
    expect(resolvePublicImageSource(asset, "content-card").fileId).toBe("RCAT_thumbnail_ABC123");
    expect(selectPublicImageSource(asset, "content-body")).toBe(asset.previewUrl);
    expect(resolvePublicImageSource(asset, "content-body").fileId).toBe("RCAT_preview_ABC123");
  });

  it("falls back from an invalid thumbnail to a valid preview", () => {
    const asset = {
      type: "image",
      thumbnailUrl: "https://drive.google.com/file/d/invalid$id/view",
      previewUrl: "https://drive.google.com/file/d/RCAT_preview_fallback/view",
      driveUrl: "https://drive.google.com/file/d/RCAT_drive_fallback/view"
    };

    expect(selectPublicImageSource(asset, "content-card")).toBe(asset.previewUrl);
    expect(resolvePublicImageSource(asset, "content-card").fileId).toBe("RCAT_preview_fallback");
  });

  it("falls back to driveUrl when both thumbnail and preview are unusable", () => {
    const asset = {
      type: "image",
      thumbnailUrl: "https://drive.google.com/file/d/invalid$id/view",
      previewUrl: "https://drive.google.com/open",
      driveUrl: "https://drive.google.com/file/d/RCAT_drive_only_fallback/view"
    };

    expect(resolvePublicImageSource(asset, "content-card").fileId).toBe("RCAT_drive_only_fallback");
  });

  it("skips unsafe, malformed Drive, and Facebook CDN candidates while preserving precedence", () => {
    const validPreviewUrl = "https://drive.google.com/file/d/RCAT_safe_preview/view";

    expect(
      resolvePublicImageSource(
        {
          type: "image",
          thumbnailUrl: "javascript:alert(1)",
          previewUrl: validPreviewUrl
        },
        "content-card"
      ).fileId
    ).toBe("RCAT_safe_preview");
    expect(
      resolvePublicImageSource(
        {
          type: "image",
          thumbnailUrl: "https://drive.google.com/file/d/invalid$id/view",
          previewUrl: validPreviewUrl
        },
        "content-card"
      ).fileId
    ).toBe("RCAT_safe_preview");
    expect(
      resolvePublicImageSource(
        {
          type: "image",
          thumbnailUrl: "https://scontent.example.fbcdn.net/photo.jpg",
          previewUrl: validPreviewUrl
        },
        "content-card"
      ).fileId
    ).toBe("RCAT_safe_preview");
  });

  it("returns an empty descriptor only after every candidate is unusable", () => {
    expect(
      resolvePublicImageSource(
        {
          type: "image",
          thumbnailUrl: "javascript:alert(1)",
          previewUrl: "https://scontent.example.fbcdn.net/photo.jpg",
          driveUrl: "https://drive.google.com/open"
        },
        "content-card"
      )
    ).toEqual({
      fileId: "",
      originalUrl: "",
      src: "",
      srcSet: "",
      widths: []
    });
  });

  it("preserves local and arbitrary HTTPS sources without inventing variants", () => {
    expect(resolvePublicImageSource("/rcat-logo-128.png", "logo")).toMatchObject({
      src: "/rcat-logo-128.png",
      srcSet: ""
    });
    expect(resolvePublicImageSource("https://images.example.edu/photo.jpg", "featured-card")).toMatchObject({
      src: "https://images.example.edu/photo.jpg",
      srcSet: ""
    });
  });

  it("rejects unsafe resources, invalid Drive IDs, and Facebook CDN images", () => {
    expect(resolvePublicImageSource("javascript:alert(1)", "content-card").src).toBe("");
    expect(resolvePublicImageSource("https://drive.google.com/file/d/unsafe$id/view", "content-card").src).toBe("");
    expect(resolvePublicImageSource("https://scontent.example.fbcdn.net/photo.jpg", "content-card").src).toBe("");
  });
});
