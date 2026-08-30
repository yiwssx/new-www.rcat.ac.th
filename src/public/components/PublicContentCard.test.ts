import { describe, expect, it } from "vitest";
import type { MediaAsset, PublicContentCardItem } from "../../types";
import { resolveCardThumbnail } from "./PublicContentCard";

function content(overrides: Partial<PublicContentCardItem> = {}): PublicContentCardItem {
  return {
    id: "content-1",
    title: "ข่าวทดสอบ",
    slug: "test-news",
    type: "news",
    status: "published",
    owner: "Admin",
    summary: "สรุป",
    category: "ข่าว",
    tags: [],
    canonicalUrl: "",
    featured: false,
    readingMinutes: 1,
    template: "standard",
    featuredMediaId: "",
    mediaIds: [],
    publishAt: "2026-08-30T00:00:00.000Z",
    ...overrides
  };
}

function media(id: string, type: MediaAsset["type"] = "image"): MediaAsset {
  return {
    id,
    name: id,
    type,
    size: "1 KB",
    owner: "Admin",
    driveUrl: `https://drive.google.com/file/d/${id}/view`,
    thumbnailUrl: type === "image" ? `https://drive.google.com/thumbnail?id=${id}` : "",
    updatedAt: "2026-08-30T00:00:00.000Z"
  };
}

describe("resolveCardThumbnail", () => {
  it("keeps an explicitly selected image ahead of attached media", () => {
    const featured = media("featured");
    const attached = media("attached");

    expect(
      resolveCardThumbnail(content({ featuredMediaId: featured.id, mediaIds: [attached.id] }), [attached, featured])
    ).toEqual(featured);
  });

  it("uses the first attached image automatically when no featured image is selected", () => {
    const document = media("document", "document");
    const firstImage = media("first-image");
    const secondImage = media("second-image");

    expect(
      resolveCardThumbnail(
        content({ mediaIds: [document.id, firstImage.id, secondImage.id] }),
        [document, secondImage, firstImage]
      )
    ).toEqual(firstImage);
  });

  it("returns undefined only when no usable image exists", () => {
    expect(resolveCardThumbnail(content({ mediaIds: ["document"] }), [media("document", "document")])).toBeUndefined();
  });
});
