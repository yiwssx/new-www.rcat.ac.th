import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPublicCmsCache,
  getPublicContentDetailCache,
  PUBLIC_CONTENT_DETAIL_CACHE_PREFIX,
  readPublicCache,
  removePublicCache,
  setPublicContentDetailCache,
  writePublicCache
} from "../services/publicCmsCache";
import { ContentItem } from "../types";

const testCacheKey = "rcat.cms.public.test";

function createContentItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "content-1",
    title: "Test content",
    slug: "test-content",
    type: "news",
    status: "published",
    owner: "RCAT",
    summary: "Cached public content",
    updatedAt: "2026-04-29T00:00:00.000Z",
    publishAt: "2026-04-29T00:00:00.000Z",
    ...overrides
  };
}

afterEach(() => {
  vi.useRealTimers();
  clearPublicCmsCache();
  removePublicCache(testCacheKey);
});

describe("publicCmsCache", () => {
  it("returns null when no cache exists", () => {
    expect(readPublicCache<{ value: string }>(testCacheKey)).toBeNull();
  });

  it("returns data when cache is fresh", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T00:00:00.000Z"));

    writePublicCache(testCacheKey, { value: "fresh" }, 60_000);

    expect(readPublicCache<{ value: string }>(testCacheKey)).toEqual({
      data: { value: "fresh" },
      savedAt: Date.parse("2026-04-29T00:00:00.000Z")
    });
  });

  it("returns null and removes cache when expired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T00:00:00.000Z"));

    writePublicCache(testCacheKey, { value: "expired" }, 1_000);
    vi.setSystemTime(new Date("2026-04-29T00:00:02.000Z"));

    expect(readPublicCache<{ value: string }>(testCacheKey)).toBeNull();
    expect(window.localStorage.getItem(testCacheKey)).toBeNull();
  });

  it("handles invalid JSON safely", () => {
    window.localStorage.setItem(testCacheKey, "{broken");

    expect(readPublicCache<{ value: string }>(testCacheKey)).toBeNull();
    expect(window.localStorage.getItem(testCacheKey)).toBeNull();
  });

  it("uses encoded slugs for content detail cache keys", () => {
    const slug = "ข่าว/รับสมัคร 2026";
    const expectedKey = `${PUBLIC_CONTENT_DETAIL_CACHE_PREFIX}${encodeURIComponent(slug)}`;
    const content = createContentItem({ slug });

    setPublicContentDetailCache(slug, content);

    expect(window.localStorage.getItem(expectedKey)).not.toBeNull();
    expect(getPublicContentDetailCache(slug)?.data).toEqual(content);
  });
});
