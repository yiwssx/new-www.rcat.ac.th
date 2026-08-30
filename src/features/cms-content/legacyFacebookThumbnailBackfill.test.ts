import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem } from "../public-content/types";
import { backfillLegacyFacebookThumbnails } from "./legacyFacebookThumbnailBackfill";

const paginationMock = vi.hoisted(() => ({
  getAdminContentList: vi.fn()
}));

const cloudflareMock = vi.hoisted(() => ({
  getAdminContentDetailFromCloudflare: vi.fn(),
  saveContentItemToCloudflare: vi.fn()
}));

const mediaMock = vi.hoisted(() => ({
  importFacebookThumbnailAsset: vi.fn()
}));

vi.mock("../admin-pagination/api", () => ({
  getAdminContentList: paginationMock.getAdminContentList
}));

vi.mock("../admin-write/cloudflareApi", () => ({
  getAdminContentDetailFromCloudflare: cloudflareMock.getAdminContentDetailFromCloudflare,
  saveContentItemToCloudflare: cloudflareMock.saveContentItemToCloudflare
}));

vi.mock("../cms-media", () => ({
  importFacebookThumbnailAsset: mediaMock.importFacebookThumbnailAsset
}));

function createContentItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "content-1",
    title: "Facebook post",
    slug: "facebook-post",
    type: "news",
    status: "published",
    owner: "Admin",
    summary: "Facebook summary",
    canonicalUrl: "https://www.facebook.com/rcat/posts/101",
    template: "facebook-embed",
    featuredMediaId: "",
    mediaIds: [],
    updatedAt: "2026-08-30T00:00:00.000Z",
    publishAt: "2026-08-14T10:22:00+07:00",
    revision: 1,
    ...overrides
  };
}

function paginated(items: ContentItem[], page: number, totalPages: number) {
  return {
    items,
    pagination: {
      page,
      pageSize: 100,
      totalItems: items.length,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages
    },
    generatedAt: "2026-08-30T00:00:00.000Z"
  };
}

describe("legacy Facebook thumbnail backfill", () => {
  beforeEach(() => {
    paginationMock.getAdminContentList.mockReset();
    cloudflareMock.getAdminContentDetailFromCloudflare.mockReset();
    cloudflareMock.saveContentItemToCloudflare.mockReset();
    mediaMock.importFacebookThumbnailAsset.mockReset();
  });

  it("repairs published Facebook posts without media and skips posts that already have attachments", async () => {
    const missing = createContentItem();
    const attached = createContentItem({
      id: "content-2",
      slug: "facebook-post-2",
      canonicalUrl: "https://www.facebook.com/rcat/posts/102"
    });
    const ordinary = createContentItem({
      id: "content-3",
      slug: "ordinary-post",
      canonicalUrl: "https://www.rcat.ac.th/news/ordinary",
      template: "standard"
    });

    paginationMock.getAdminContentList.mockResolvedValue(paginated([missing, attached, ordinary], 1, 1));
    cloudflareMock.getAdminContentDetailFromCloudflare.mockImplementation(async ({ id }: { id: string }) =>
      id === attached.id ? { ...attached, mediaIds: ["existing-media"] } : missing
    );
    mediaMock.importFacebookThumbnailAsset.mockResolvedValue({ id: "facebook-thumbnail-101" });
    cloudflareMock.saveContentItemToCloudflare.mockImplementation(async (item: ContentItem) => item);

    const result = await backfillLegacyFacebookThumbnails();

    expect(result).toEqual({
      scanned: 3,
      candidates: 2,
      repaired: 1,
      skipped: 1,
      failed: 0,
      failedIds: []
    });
    expect(mediaMock.importFacebookThumbnailAsset).toHaveBeenCalledTimes(1);
    expect(cloudflareMock.saveContentItemToCloudflare).toHaveBeenCalledWith(
      expect.objectContaining({
        id: missing.id,
        featuredMediaId: "facebook-thumbnail-101",
        mediaIds: ["facebook-thumbnail-101"]
      })
    );
  });

  it("scans every page and reports individual preview failures without blocking other repairs", async () => {
    const first = createContentItem();
    const second = createContentItem({
      id: "content-2",
      slug: "facebook-post-2",
      canonicalUrl: "https://www.facebook.com/rcat/posts/102"
    });

    paginationMock.getAdminContentList.mockImplementation(async ({ page }: { page: number }) =>
      page === 1 ? paginated([first], 1, 2) : paginated([second], 2, 2)
    );
    cloudflareMock.getAdminContentDetailFromCloudflare.mockImplementation(async ({ id }: { id: string }) =>
      id === first.id ? first : second
    );
    mediaMock.importFacebookThumbnailAsset.mockImplementation(async ({ sourceUrl }: { sourceUrl: string }) => {
      if (sourceUrl.endsWith("/102")) {
        throw new Error("Facebook preview image is unavailable");
      }

      return { id: "facebook-thumbnail-101" };
    });
    cloudflareMock.saveContentItemToCloudflare.mockImplementation(async (item: ContentItem) => item);

    const result = await backfillLegacyFacebookThumbnails();

    expect(paginationMock.getAdminContentList).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      scanned: 2,
      candidates: 2,
      repaired: 1,
      skipped: 0,
      failed: 1,
      failedIds: [second.id]
    });
    expect(cloudflareMock.saveContentItemToCloudflare).toHaveBeenCalledTimes(1);
  });
});
