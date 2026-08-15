import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPublicCmsCache,
  getPublicContentDetailCache,
  PUBLIC_CONTENT_DETAIL_CACHE_PREFIX,
  PUBLIC_SNAPSHOT_CACHE_KEY,
  readPublicCache,
  removePublicCache,
  removePublicContentDetailCache,
  setPublicContentDetailCache,
  setPublicSnapshotCache,
  writePublicCache
} from "../services/publicCmsCache";
import {
  getPublicContentListCache,
  getPublicContentListCacheKey,
  setPublicContentListCache
} from "../services/publicContentListCache";
import {
  getPublicDocumentListCache,
  PUBLIC_DOCUMENT_LIST_CACHE_KEY,
  setPublicDocumentListCache
} from "../features/public-documents";
import { getPublicHomeCache, PUBLIC_HOME_CACHE_KEY, setPublicHomeCache } from "../services/publicHomeCache";
import {
  getPublicProgramListCache,
  PUBLIC_PROGRAM_LIST_CACHE_KEY,
  setPublicProgramListCache
} from "../services/publicProgramListCache";
import {
  getPublicSearchIndexCache,
  PUBLIC_SEARCH_INDEX_CACHE_KEY,
  setPublicSearchIndexCache
} from "../services/publicSearchIndexCache";
import {
  CmsSnapshot,
  ContentItem,
  PublicContentDetailSnapshot,
  PublicContentListSnapshot,
  PublicDocumentListSnapshot,
  PublicProgramListSnapshot,
  PublicSearchIndexSnapshot
} from "../types";

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

function createPublicContentDetailSnapshot(item: ContentItem): PublicContentDetailSnapshot {
  return {
    item,
    media: [],
    generatedAt: item.updatedAt
  };
}

function createPublicContentListSnapshot(
  overrides: Partial<PublicContentListSnapshot> = {}
): PublicContentListSnapshot {
  return {
    kind: "news",
    items: [],
    media: [],
    siteSettings: {
      siteName: "Test site",
      eyebrow: "",
      intro: "",
      campus: "",
      phone: "",
      fax: "",
      email: "",
      address: "",
      admissionUrl: "",
      facebookUrl: "",
      youtubeUrl: "",
      tiktokUrl: "",
      heroTitle: "",
      heroDescription: "",
      heroChip: "",
      heroImageUrl: "",
      directorName: "",
      directorTitle: "",
      directorDescription: "",
      directorImageUrl: "",
      mapUrl: "",
      mapEmbedUrl: "",
      footerTitle: "",
      footerDescription: "",
      footerDirectoryGroups: [],
      messengerUrl: "",
      messengerLabel: "แชทกับเจ้าหน้าที่",
      messengerEnabled: false,
      mourningModeEnabled: false,
      mourningModeLabel: "โหมดไว้อาลัย",
      mourningModeNotice: ""
    },
    homepageSettings: {
      carousel: {
        autoplayEnabled: true,
        autoplayIntervalSeconds: 5,
        showArrows: true,
        showDots: true,
        pauseOnHover: true,
        pauseOnFocus: true,
        transition: "slide"
      },
      introGate: {
        enabled: false,
        imageUrl: "",
        imageAlt: "",
        primaryButtonLabel: "",
        secondaryButtonLabel: "",
        secondaryButtonUrl: "",
        storageKey: ""
      },
      marquee: {
        enabled: false,
        label: "",
        text: "",
        speedSeconds: 32
      },
      introVideo: {
        enabled: false,
        title: "",
        youtubeEmbedUrl: ""
      }
    },
    menu: [],
    generatedAt: "2026-05-12T00:00:00.000Z",
    ...overrides
  };
}

function createPublicProgramListSnapshot(
  overrides: Partial<PublicProgramListSnapshot> = {}
): PublicProgramListSnapshot {
  const contentListSnapshot = createPublicContentListSnapshot();

  return {
    items: [],
    media: [],
    siteSettings: contentListSnapshot.siteSettings,
    homepageSettings: contentListSnapshot.homepageSettings,
    menu: [],
    generatedAt: "2026-05-12T00:00:00.000Z",
    ...overrides
  };
}

function createPublicSearchIndexSnapshot(
  overrides: Partial<PublicSearchIndexSnapshot> = {}
): PublicSearchIndexSnapshot {
  const contentListSnapshot = createPublicContentListSnapshot();

  return {
    items: [],
    siteSettings: contentListSnapshot.siteSettings,
    homepageSettings: contentListSnapshot.homepageSettings,
    menu: [],
    generatedAt: "2026-05-12T00:00:00.000Z",
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
    const detailSnapshot = createPublicContentDetailSnapshot(content);

    setPublicContentDetailCache(slug, detailSnapshot);

    expect(window.localStorage.getItem(expectedKey)).not.toBeNull();
    expect(getPublicContentDetailCache(slug)?.data).toEqual(detailSnapshot);
  });

  it("removes only the requested encoded content detail cache", () => {
    const deletedSlug = "ข่าว/รับสมัคร 2026?รอบ=1";
    const otherSlug = "ข่าวประชาสัมพันธ์";
    const deletedKey = `${PUBLIC_CONTENT_DETAIL_CACHE_PREFIX}${encodeURIComponent(deletedSlug)}`;
    const otherKey = `${PUBLIC_CONTENT_DETAIL_CACHE_PREFIX}${encodeURIComponent(otherSlug)}`;
    const doubleEncodedKey = `${PUBLIC_CONTENT_DETAIL_CACHE_PREFIX}${encodeURIComponent(encodeURIComponent(deletedSlug))}`;
    const deletedContent = createContentItem({ id: "deleted-content", slug: deletedSlug });
    const otherContent = createContentItem({ id: "other-content", slug: otherSlug });
    const deletedSnapshot = createPublicContentDetailSnapshot(deletedContent);
    const otherSnapshot = createPublicContentDetailSnapshot(otherContent);

    setPublicContentDetailCache(deletedSlug, deletedSnapshot);
    setPublicContentDetailCache(otherSlug, otherSnapshot);
    removePublicContentDetailCache(deletedSlug);

    expect(window.localStorage.getItem(deletedKey)).toBeNull();
    expect(window.localStorage.getItem(doubleEncodedKey)).toBeNull();
    expect(getPublicContentDetailCache(deletedSlug)).toBeNull();
    expect(window.localStorage.getItem(otherKey)).not.toBeNull();
    expect(getPublicContentDetailCache(otherSlug)?.data).toEqual(otherSnapshot);
  });

  it("ignores empty content detail cache removals", () => {
    expect(() => removePublicContentDetailCache("")).not.toThrow();
    expect(() => removePublicContentDetailCache(undefined)).not.toThrow();
  });

  it("keeps public home cache separate and clears it with public CMS cache", () => {
    const snapshot: CmsSnapshot = {
      metrics: [],
      content: [],
      media: [],
      events: []
    };
    const homeSnapshot = {
      siteSettings: {
        siteName: "Test site",
        eyebrow: "",
        intro: "",
        campus: "",
        phone: "",
        fax: "",
        email: "",
        address: "",
        admissionUrl: "",
        facebookUrl: "",
        youtubeUrl: "",
        tiktokUrl: "",
        heroTitle: "",
        heroDescription: "",
        heroChip: "",
        heroImageUrl: "",
        directorName: "",
        directorTitle: "",
        directorDescription: "",
        directorImageUrl: "",
        mapUrl: "",
        mapEmbedUrl: "",
        footerTitle: "",
        footerDescription: "",
        footerDirectoryGroups: [],
        messengerUrl: "",
        messengerLabel: "แชทกับเจ้าหน้าที่",
        messengerEnabled: false,
        mourningModeEnabled: false,
        mourningModeLabel: "โหมดไว้อาลัย",
        mourningModeNotice: ""
      },
      homepageSettings: {
        carousel: {
          autoplayEnabled: true,
          autoplayIntervalSeconds: 5,
          showArrows: true,
          showDots: true,
          pauseOnHover: true,
          pauseOnFocus: true,
          transition: "slide"
        },
        introGate: {
          enabled: false,
          imageUrl: "",
          imageAlt: "",
          primaryButtonLabel: "",
          secondaryButtonLabel: "",
          secondaryButtonUrl: "",
          storageKey: ""
        },
        marquee: {
          enabled: false,
          label: "",
          text: "",
          speedSeconds: 32
        },
        introVideo: {
          enabled: false,
          title: "",
          youtubeEmbedUrl: ""
        }
      },
      menu: [],
      carouselSlides: [],
      externalServices: [],
      visitorStats: {
        enabled: false,
        usersToday: 0,
        usersYesterday: 0,
        usersThisMonth: 0,
        usersThisYear: 0,
        totalUsers: 0,
        totalViews: 0,
        onlineUsers: 0,
        updatedAt: ""
      },
      latestNews: [],
      latestAnnouncements: [],
      procurementItems: [],
      jobOpportunityItems: [],
      achievementItems: [],
      programItems: [],
      documentItems: [],
      eventItems: [],
      media: [],
      generatedAt: "2026-05-12T00:00:00.000Z"
    };

    setPublicSnapshotCache(snapshot);
    setPublicHomeCache(homeSnapshot);

    expect(PUBLIC_HOME_CACHE_KEY).not.toBe(PUBLIC_SNAPSHOT_CACHE_KEY);
    expect(getPublicHomeCache()?.data).toEqual(homeSnapshot);

    clearPublicCmsCache();

    expect(window.localStorage.getItem(PUBLIC_SNAPSHOT_CACHE_KEY)).toBeNull();
    expect(window.localStorage.getItem(PUBLIC_HOME_CACHE_KEY)).toBeNull();
  });

  it("keeps public content list caches separate by kind and clears them with public CMS cache", () => {
    const newsSnapshot = createPublicContentListSnapshot({
      kind: "news",
      items: [createContentItem({ id: "news-1", title: "Cached news" })]
    });
    const blogSnapshot = createPublicContentListSnapshot({
      kind: "blog",
      items: [createContentItem({ id: "blog-1", title: "Cached blog", type: "blog" })]
    });

    setPublicContentListCache("news", newsSnapshot);
    setPublicContentListCache("blog", blogSnapshot);

    expect(getPublicContentListCacheKey("news")).not.toBe(getPublicContentListCacheKey("blog"));
    expect(getPublicContentListCache("news")?.data).toEqual(newsSnapshot);
    expect(getPublicContentListCache("blog")?.data).toEqual(blogSnapshot);

    clearPublicCmsCache();

    expect(window.localStorage.getItem(getPublicContentListCacheKey("news"))).toBeNull();
    expect(window.localStorage.getItem(getPublicContentListCacheKey("blog"))).toBeNull();
  });

  it("keeps public program list cache separate and clears it with public CMS cache", () => {
    const programSnapshot = createPublicProgramListSnapshot({
      items: [createContentItem({ id: "program-1", title: "Cached program", type: "program" })]
    });

    setPublicProgramListCache(programSnapshot);

    expect(PUBLIC_PROGRAM_LIST_CACHE_KEY).not.toBe(PUBLIC_SNAPSHOT_CACHE_KEY);
    expect(getPublicProgramListCache()?.data).toEqual(programSnapshot);

    clearPublicCmsCache();

    expect(window.localStorage.getItem(PUBLIC_PROGRAM_LIST_CACHE_KEY)).toBeNull();
  });

  it("keeps public document list cache separate and clears it with public CMS cache", () => {
    const documentSnapshot: PublicDocumentListSnapshot = {
      items: [
        {
          id: "document-1",
          title: "Cached public document",
          description: "Document description",
          category: "Policy",
          fileUrl: "https://example.edu/document.pdf",
          fileName: "document.pdf",
          mediaId: "media-1",
          publishedAt: "2026-05-04T00:00:00.000Z",
          order: 1,
          pinned: true,
          updatedAt: "2026-05-04T00:00:00.000Z"
        }
      ],
      generatedAt: "2026-05-04T00:00:00.000Z"
    };

    setPublicDocumentListCache(documentSnapshot);

    expect(PUBLIC_DOCUMENT_LIST_CACHE_KEY).not.toBe(PUBLIC_SNAPSHOT_CACHE_KEY);
    expect(getPublicDocumentListCache()?.data).toEqual(documentSnapshot);

    clearPublicCmsCache();

    expect(window.localStorage.getItem(PUBLIC_DOCUMENT_LIST_CACHE_KEY)).toBeNull();
  });

  it("keeps public search index cache separate and clears it with public CMS cache", () => {
    const searchSnapshot = createPublicSearchIndexSnapshot({
      items: [createContentItem({ id: "search-1", title: "Cached search result" })]
    });

    setPublicSearchIndexCache(searchSnapshot);

    expect(PUBLIC_SEARCH_INDEX_CACHE_KEY).not.toBe(PUBLIC_SNAPSHOT_CACHE_KEY);
    expect(getPublicSearchIndexCache()?.data).toEqual(searchSnapshot);

    clearPublicCmsCache();

    expect(window.localStorage.getItem(PUBLIC_SEARCH_INDEX_CACHE_KEY)).toBeNull();
  });
});
