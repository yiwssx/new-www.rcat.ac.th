import { describe, expect, it, vi, type Mock } from "vitest";
import cmsSource from "../../apps-script/Cms.gs?raw";

interface HttpError extends Error {
  statusCode?: number;
}

interface CmsScriptContext {
  assertUniqueContentSlug: (sheet: unknown, contentId: string, normalizedSlug: string) => void;
  contentValues: unknown[][];
  getPublicContentListSnapshot: (query: Record<string, unknown>) => Record<string, unknown>;
  getPublicHomeSnapshot: () => Record<string, unknown>;
  getPublicProgramListSnapshot: () => Record<string, unknown>;
  getPublicSearchIndexSnapshot: () => Record<string, unknown>;
  getCarouselSlides: (options?: { includeDisabled?: boolean }) => Array<Record<string, unknown>>;
  getExternalServices: (options?: { includeDisabled?: boolean }) => Array<Record<string, unknown>>;
  incrementContentView: (input: { id?: string; slug?: string }) => {
    id: string;
    slug: string;
    viewCount: number;
    lastViewedAt: string;
  };
  invalidatePublicSnapshotCache: Mock;
  isAllowedUploadMimeType: (value: string) => boolean;
  isCarouselSlideVisible: (slide: Record<string, unknown>, now: Date) => boolean;
  isExternalServiceVisible: (service: Record<string, unknown>) => boolean;
  lockService: {
    getScriptLock: Mock;
  };
  normalizePublicMediaUrl: (url: string, allowedHosts?: string[]) => string;
  normalizeCarouselSlideRecord: (
    row: Record<string, unknown>,
    fallback?: Record<string, unknown>
  ) => Record<string, unknown>;
  normalizeExternalServiceRecord: (
    row: Record<string, unknown>,
    fallback?: Record<string, unknown>
  ) => Record<string, unknown>;
  normalizeSlugValue: (value: string) => string;
  resolveUploadMimeType: (asset: { mimeType?: string; fileBase64?: string }) => string;
  sanitizePublicContentRecord: (
    item: Record<string, unknown>,
    options?: { includeBody?: boolean }
  ) => Record<string, unknown>;
  sanitizePublicMediaRecord: (asset: Record<string, unknown>) => Record<string, unknown>;
  scriptLock: {
    tryLock: Mock;
    releaseLock: Mock;
  };
  validateContentStatus: (value: string) => string;
  validateContentType: (value: string) => string;
  validateUploadBytes: (bytes: { length: number } | null) => void;
  readObjects: Mock;
}

const TEST_CONTENT_HEADERS = [
  "id",
  "title",
  "slug",
  "type",
  "status",
  "owner",
  "summary",
  "category",
  "tags",
  "seoTitle",
  "seoDescription",
  "canonicalUrl",
  "featured",
  "readingMinutes",
  "template",
  "body",
  "bodyDocId",
  "bodyDocUrl",
  "featuredMediaId",
  "mediaIds",
  "updatedAt",
  "publishAt",
  "viewCount",
  "lastViewedAt"
];

const TEST_CAROUSEL_HEADERS = [
  "id",
  "title",
  "subtitle",
  "chip",
  "imageUrl",
  "imageAlt",
  "buttonLabel",
  "href",
  "enabled",
  "order",
  "startAt",
  "endAt",
  "updatedAt"
];

const TEST_MEDIA_HEADERS = [
  "id",
  "name",
  "type",
  "size",
  "owner",
  "driveUrl",
  "fileId",
  "mimeType",
  "previewUrl",
  "embedUrl",
  "updatedAt"
];

const TEST_EXTERNAL_SERVICE_HEADERS = [
  "id",
  "title",
  "description",
  "href",
  "tone",
  "iconKey",
  "enabled",
  "order",
  "updatedAt"
];

const TEST_EVENT_HEADERS = [
  "id",
  "title",
  "date",
  "endDate",
  "audience",
  "status",
  "location",
  "description",
  "category",
  "visibility",
  "updatedAt"
];

const TEST_DOCUMENT_HEADERS = [
  "id",
  "title",
  "description",
  "category",
  "fileUrl",
  "fileName",
  "mediaId",
  "publishedAt",
  "status",
  "order",
  "pinned",
  "updatedAt"
];

function createHttpError(message: string, statusCode: number) {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  return error;
}

function createContentRow(record: Record<string, unknown>) {
  return TEST_CONTENT_HEADERS.map((header) => record[header] ?? "");
}

function loadCmsScript(input: { contentRows?: Array<Record<string, unknown>> } = {}) {
  const readObjects = vi.fn();
  const contentValues: unknown[][] = [TEST_CONTENT_HEADERS, ...(input.contentRows ?? []).map(createContentRow)];
  const contentSheet = {
    getDataRange: vi.fn(() => ({
      getValues: () => contentValues
    })),
    getName: () => "Content",
    getRange: vi.fn((row: number, column: number) => ({
      setValue: (value: unknown) => {
        contentValues[row - 1][column - 1] = value;
      }
    }))
  };
  const getSpreadsheet = vi.fn(() => ({
    getSheetByName: () => contentSheet
  }));
  const scriptLock = {
    tryLock: vi.fn(() => true),
    releaseLock: vi.fn()
  };
  const lockService = {
    getScriptLock: vi.fn(() => scriptLock)
  };
  const ensureSheet = vi.fn(() => contentSheet);
  const getActiveHeaders = vi.fn(() => TEST_CONTENT_HEADERS);
  const invalidatePublicSnapshotCache = vi.fn();
  const createScriptExports = new Function(
    "console",
    "createHttpError",
    "getSpreadsheet",
    "ensureSheet",
    "getActiveHeaders",
    "invalidatePublicSnapshotCache",
    "readObjects",
    "getMenu",
    "getDisplaySettings",
    "getSiteSettings",
    "getHomepageSettings",
    "getVisitorStats",
    "LockService",
    "CONTENT_HEADERS",
    "MEDIA_HEADERS",
    "CAROUSEL_HEADERS",
    "EXTERNAL_SERVICE_HEADERS",
    "EVENT_HEADERS",
    "DOCUMENT_HEADERS",
    "SHEETS",
    `${cmsSource}
return {
  assertUniqueContentSlug,
  getPublicContentListSnapshot,
  getPublicHomeSnapshot,
  getPublicProgramListSnapshot,
  getPublicSearchIndexSnapshot,
  getCarouselSlides,
  getExternalServices,
  incrementContentView,
  isAllowedUploadMimeType,
  isCarouselSlideVisible,
  isExternalServiceVisible,
  normalizeCarouselSlideRecord,
  normalizeExternalServiceRecord,
  normalizePublicMediaUrl,
  normalizeSlugValue,
  resolveUploadMimeType,
  sanitizePublicContentRecord,
  sanitizePublicMediaRecord,
  validateContentStatus,
  validateContentType,
  validateUploadBytes
};`
  );
  const exports = createScriptExports(
    console,
    createHttpError,
    getSpreadsheet,
    ensureSheet,
    getActiveHeaders,
    invalidatePublicSnapshotCache,
    readObjects,
    vi.fn(() => []),
    vi.fn(() => ({ dateFormat: "D MMM BBBB", timeMode: "24h" })),
    vi.fn(() => ({ siteName: "Public site" })),
    vi.fn(() => ({})),
    vi.fn(() => ({ enabled: false })),
    lockService,
    TEST_CONTENT_HEADERS,
    TEST_MEDIA_HEADERS,
    TEST_CAROUSEL_HEADERS,
    TEST_EXTERNAL_SERVICE_HEADERS,
    TEST_EVENT_HEADERS,
    TEST_DOCUMENT_HEADERS,
    {
      content: "Content",
      carousel: "Carousel",
      externalServices: "ExternalServices",
      media: "Media",
      events: "Events",
      documents: "Documents"
    }
  ) as Omit<CmsScriptContext, "readObjects">;

  return {
    ...exports,
    contentValues,
    invalidatePublicSnapshotCache,
    lockService,
    readObjects,
    scriptLock
  };
}

function captureError(fn: () => void) {
  try {
    fn();
    return null;
  } catch (error) {
    return error as HttpError;
  }
}

describe("Apps Script CMS helpers", () => {
  it("normalizes slugs and rejects duplicate slugs for other content records", () => {
    const context = loadCmsScript();
    context.readObjects.mockReturnValue([
      { id: "content-1", slug: "Admissions" },
      { id: "content-legacy", slug: "../legacy" },
      { id: "content-2", slug: "student-news" }
    ]);

    expect(context.normalizeSlugValue("Admissions")).toBe("admissions");
    expect(() => context.assertUniqueContentSlug({}, "content-1", "admissions")).not.toThrow();

    const error = captureError(() => context.assertUniqueContentSlug({}, "content-3", "admissions"));
    expect(error?.message).toBe("Slug นี้ถูกใช้งานแล้ว กรุณาเปลี่ยนลิงก์ถาวร");
    expect(error?.statusCode).toBe(409);
  });

  it("strictly validates safe Thai and English slug formats", () => {
    const context = loadCmsScript();

    expect(context.normalizeSlugValue("ข่าวรับสมัคร-2569")).toBe("ข่าวรับสมัคร-2569");
    expect(context.normalizeSlugValue("student-news-2026")).toBe("student-news-2026");
    expect(context.normalizeSlugValue("--Student---News-2026--")).toBe("student-news-2026");

    [
      "../admin",
      "abc/def",
      "abc?x=1",
      "hello world",
      "abc#section",
      "abc:def",
      "abc\\def",
      "",
      "---",
      "a".repeat(121)
    ].forEach((slug) => {
      const error = captureError(() => context.normalizeSlugValue(slug));
      expect(error?.message).toBe("Invalid slug format.");
      expect(error?.statusCode).toBe(400);
    });
  });

  it("validates content type and status values", () => {
    const context = loadCmsScript();

    expect(context.validateContentType(" News ")).toBe("news");
    expect(context.validateContentStatus("PUBLISHED")).toBe("published");

    expect(captureError(() => context.validateContentType("script"))?.statusCode).toBe(400);
    expect(captureError(() => context.validateContentStatus("archived"))?.statusCode).toBe(400);
  });

  it("scrubs document storage fields from public content records", () => {
    const context = loadCmsScript();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const item = {
      id: "content-1",
      title: "Public item",
      body: "Body text",
      bodyDocId: "doc-id",
      bodyDocUrl: "https://docs.google.com/document/d/doc-id",
      canonicalUrl: "javascript:alert(1)",
      mediaIds: ["media-1"]
    };

    const snapshotRecord = context.sanitizePublicContentRecord(item);
    expect(snapshotRecord).not.toHaveProperty("body");
    expect(snapshotRecord).not.toHaveProperty("bodyDocId");
    expect(snapshotRecord).not.toHaveProperty("bodyDocUrl");
    expect(snapshotRecord.canonicalUrl).toBe("");
    expect(snapshotRecord.mediaIds).toEqual(["media-1"]);

    const detailRecord = context.sanitizePublicContentRecord(item, { includeBody: true });
    expect(detailRecord.body).toBe("Body text");
    expect(detailRecord).not.toHaveProperty("bodyDocId");
    expect(detailRecord).not.toHaveProperty("bodyDocUrl");
    warnSpy.mockRestore();
  });

  it("increments view count only for published public content", () => {
    const context = loadCmsScript({
      contentRows: [
        {
          id: "content-1",
          slug: "announcement-1",
          status: "published",
          viewCount: "4"
        }
      ]
    });
    const result = context.incrementContentView({ slug: "announcement-1" });
    const viewCountIndex = TEST_CONTENT_HEADERS.indexOf("viewCount");
    const lastViewedAtIndex = TEST_CONTENT_HEADERS.indexOf("lastViewedAt");

    expect(result.id).toBe("content-1");
    expect(result.slug).toBe("announcement-1");
    expect(result.viewCount).toBe(5);
    expect(result.lastViewedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(context.contentValues[1][viewCountIndex]).toBe(5);
    expect(context.contentValues[1][lastViewedAtIndex]).toBe(result.lastViewedAt);
    expect(context.lockService.getScriptLock).toHaveBeenCalledTimes(1);
    expect(context.scriptLock.tryLock).toHaveBeenCalledWith(5000);
    expect(context.scriptLock.releaseLock).toHaveBeenCalledTimes(1);
    expect(context.invalidatePublicSnapshotCache).not.toHaveBeenCalled();
  });

  it("does not increment missing or unpublished content", () => {
    const context = loadCmsScript({
      contentRows: [
        {
          id: "content-draft",
          slug: "draft-announcement",
          status: "draft",
          viewCount: "10"
        }
      ]
    });

    expect(captureError(() => context.incrementContentView({ slug: "missing" }))?.statusCode).toBe(404);
    expect(context.scriptLock.releaseLock).toHaveBeenCalledTimes(1);
    expect(captureError(() => context.incrementContentView({ slug: "draft-announcement" }))?.statusCode).toBe(404);
    expect(context.scriptLock.releaseLock).toHaveBeenCalledTimes(2);
    expect(context.contentValues[1][TEST_CONTENT_HEADERS.indexOf("viewCount")]).toBe("10");
    expect(context.invalidatePublicSnapshotCache).not.toHaveBeenCalled();
  });

  it("does not read or write view count rows when the content view lock is unavailable", () => {
    const context = loadCmsScript({
      contentRows: [
        {
          id: "content-1",
          slug: "announcement-1",
          status: "published",
          viewCount: "4"
        }
      ]
    });
    context.scriptLock.tryLock.mockReturnValue(false);

    const error = captureError(() => context.incrementContentView({ slug: "announcement-1" }));

    expect(error?.statusCode).toBe(503);
    expect(context.scriptLock.tryLock).toHaveBeenCalledWith(5000);
    expect(context.scriptLock.releaseLock).not.toHaveBeenCalled();
    expect(context.contentValues[1][TEST_CONTENT_HEADERS.indexOf("viewCount")]).toBe("4");
    expect(context.invalidatePublicSnapshotCache).not.toHaveBeenCalled();
  });

  it("reduces public media records to fields needed for rendering", () => {
    const context = loadCmsScript();
    const media = context.sanitizePublicMediaRecord({
      id: "media-1",
      name: "Public image",
      type: "image",
      size: "9 MB",
      owner: "Admin",
      driveUrl: "https://drive.google.com/file/d/media-1/view",
      fileId: "media-1",
      mimeType: "image/png",
      previewUrl: "https://drive.google.com/thumbnail?id=media-1",
      embedUrl: "https://drive.google.com/file/d/media-1/preview",
      updatedAt: "2026-04-28T00:00:00.000Z"
    });

    expect(media).toEqual({
      id: "media-1",
      name: "Public image",
      type: "image",
      size: "",
      owner: "",
      driveUrl: "https://drive.google.com/file/d/media-1/view",
      previewUrl: "https://drive.google.com/thumbnail?id=media-1",
      embedUrl: "https://drive.google.com/file/d/media-1/preview",
      updatedAt: ""
    });
    expect(media).not.toHaveProperty("fileId");
    expect(media).not.toHaveProperty("mimeType");
  });

  it("builds a limited public home snapshot without draft content or unreferenced media", () => {
    const context = loadCmsScript();
    context.readObjects.mockImplementation((_sheet: unknown, headers: string[]) => {
      if (headers === TEST_CONTENT_HEADERS) {
        return [
          {
            id: "news-1",
            title: "Published news",
            slug: "published-news",
            type: "news",
            status: "published",
            owner: "Admin",
            summary: "Visible homepage news",
            body: "Body should not be in home payload",
            featuredMediaId: "media-news",
            updatedAt: "2026-05-04T00:00:00.000Z",
            publishAt: "2026-05-04T00:00:00.000Z"
          },
          {
            id: "draft-news",
            title: "Draft news",
            slug: "draft-news",
            type: "news",
            status: "draft",
            owner: "Admin",
            summary: "Hidden draft",
            featuredMediaId: "media-draft",
            updatedAt: "2026-05-05T00:00:00.000Z",
            publishAt: "2026-05-05T00:00:00.000Z"
          },
          {
            id: "program-1",
            title: "Published program",
            slug: "published-program",
            type: "program",
            status: "published",
            owner: "Admin",
            summary: "Visible program",
            mediaIds: "media-program",
            updatedAt: "2026-05-03T00:00:00.000Z",
            publishAt: "2026-05-03T00:00:00.000Z"
          }
        ];
      }

      if (headers === TEST_MEDIA_HEADERS) {
        return [
          {
            id: "media-news",
            name: "News image",
            type: "image",
            driveUrl: "https://drive.google.com/file/d/media-news/view",
            previewUrl: "https://drive.google.com/thumbnail?id=media-news"
          },
          {
            id: "media-program",
            name: "Program image",
            type: "image",
            driveUrl: "https://drive.google.com/file/d/media-program/view",
            previewUrl: "https://drive.google.com/thumbnail?id=media-program"
          },
          {
            id: "media-draft",
            name: "Draft image",
            type: "image",
            driveUrl: "https://drive.google.com/file/d/media-draft/view",
            previewUrl: "https://drive.google.com/thumbnail?id=media-draft"
          }
        ];
      }

      if (headers === TEST_EVENT_HEADERS) {
        return [
          {
            id: "event-public",
            title: "Public event",
            date: "2026-05-20T09:00:00.000Z",
            audience: "public",
            status: "confirmed",
            visibility: "public"
          },
          {
            id: "event-private",
            title: "Private event",
            date: "2026-05-21T09:00:00.000Z",
            audience: "staff",
            status: "confirmed",
            visibility: "private"
          }
        ];
      }

      return [];
    });

    const snapshot = context.getPublicHomeSnapshot();
    const latestNews = snapshot.latestNews as Array<Record<string, unknown>>;
    const programItems = snapshot.programItems as Array<Record<string, unknown>>;
    const media = snapshot.media as Array<Record<string, unknown>>;
    const eventItems = snapshot.eventItems as Array<Record<string, unknown>>;

    expect(latestNews.map((item) => item.id)).toEqual(["news-1"]);
    expect(programItems.map((item) => item.id)).toEqual(["program-1"]);
    expect(latestNews[0]).not.toHaveProperty("body");
    expect(media.map((asset) => asset.id).sort()).toEqual(["media-news", "media-program"]);
    expect(eventItems.map((event) => event.id)).toEqual(["event-public"]);
    expect(snapshot).toHaveProperty("generatedAt");
  });

  it("builds public content list snapshots by kind with only published referenced data", () => {
    const context = loadCmsScript();
    context.readObjects.mockImplementation((_sheet: unknown, headers: string[]) => {
      if (headers === TEST_CONTENT_HEADERS) {
        return [
          {
            id: "news-1",
            title: "Published news",
            slug: "published-news",
            type: "news",
            status: "published",
            owner: "Admin",
            summary: "Visible news",
            body: "Body should not be in list payload",
            featuredMediaId: "media-news",
            updatedAt: "2026-05-04T00:00:00.000Z",
            publishAt: "2026-05-04T00:00:00.000Z"
          },
          {
            id: "news-draft",
            title: "Draft news",
            slug: "draft-news",
            type: "news",
            status: "draft",
            owner: "Admin",
            summary: "Hidden draft",
            featuredMediaId: "media-draft",
            updatedAt: "2026-05-05T00:00:00.000Z",
            publishAt: "2026-05-05T00:00:00.000Z"
          },
          {
            id: "blog-1",
            title: "Published blog",
            slug: "published-blog",
            type: "blog",
            status: "published",
            owner: "Admin",
            summary: "Visible blog",
            featuredMediaId: "media-blog",
            updatedAt: "2026-05-03T00:00:00.000Z",
            publishAt: "2026-05-03T00:00:00.000Z"
          },
          {
            id: "announcement-1",
            title: "Published announcement",
            slug: "published-announcement",
            type: "announcement",
            status: "published",
            owner: "Admin",
            summary: "Visible announcement",
            featuredMediaId: "media-announcement",
            updatedAt: "2026-05-02T00:00:00.000Z",
            publishAt: "2026-05-02T00:00:00.000Z"
          },
          {
            id: "page-1",
            title: "Published page",
            slug: "published-page",
            type: "page",
            status: "published",
            owner: "Admin",
            summary: "Visible page",
            mediaIds: "media-page",
            updatedAt: "2026-05-01T00:00:00.000Z",
            publishAt: "2026-05-01T00:00:00.000Z"
          }
        ];
      }

      if (headers === TEST_MEDIA_HEADERS) {
        return [
          {
            id: "media-news",
            name: "News image",
            type: "image",
            driveUrl: "https://drive.google.com/file/d/media-news/view",
            previewUrl: "https://drive.google.com/thumbnail?id=media-news"
          },
          {
            id: "media-blog",
            name: "Blog image",
            type: "image",
            driveUrl: "https://drive.google.com/file/d/media-blog/view",
            previewUrl: "https://drive.google.com/thumbnail?id=media-blog"
          },
          {
            id: "media-announcement",
            name: "Announcement image",
            type: "image",
            driveUrl: "https://drive.google.com/file/d/media-announcement/view",
            previewUrl: "https://drive.google.com/thumbnail?id=media-announcement"
          },
          {
            id: "media-page",
            name: "Page image",
            type: "image",
            driveUrl: "https://drive.google.com/file/d/media-page/view",
            previewUrl: "https://drive.google.com/thumbnail?id=media-page"
          },
          {
            id: "media-draft",
            name: "Draft image",
            type: "image",
            driveUrl: "https://drive.google.com/file/d/media-draft/view",
            previewUrl: "https://drive.google.com/thumbnail?id=media-draft"
          }
        ];
      }

      return [];
    });

    const newsSnapshot = context.getPublicContentListSnapshot({ kind: "news" });
    const blogSnapshot = context.getPublicContentListSnapshot({ kind: "blog" });
    const announcementsSnapshot = context.getPublicContentListSnapshot({ kind: "announcements" });

    expect((newsSnapshot.items as Array<Record<string, unknown>>).map((item) => item.id)).toEqual(["news-1"]);
    expect((newsSnapshot.items as Array<Record<string, unknown>>)[0]).not.toHaveProperty("body");
    expect((newsSnapshot.items as Array<Record<string, unknown>>)[0]).not.toHaveProperty("bodyDocId");
    expect((newsSnapshot.items as Array<Record<string, unknown>>)[0]).not.toHaveProperty("bodyDocUrl");
    expect((newsSnapshot.items as Array<Record<string, unknown>>)[0]).not.toHaveProperty("canonicalUrl");
    expect((newsSnapshot.items as Array<Record<string, unknown>>)[0]).not.toHaveProperty("viewCount");
    expect((newsSnapshot.items as Array<Record<string, unknown>>)[0]).not.toHaveProperty("lastViewedAt");
    expect((newsSnapshot.media as Array<Record<string, unknown>>).map((asset) => asset.id)).toEqual(["media-news"]);
    expect((blogSnapshot.items as Array<Record<string, unknown>>).map((item) => item.id)).toEqual(["blog-1"]);
    expect((announcementsSnapshot.items as Array<Record<string, unknown>>).map((item) => item.id)).toEqual([
      "announcement-1"
    ]);
    expect((announcementsSnapshot.pageItems as Array<Record<string, unknown>>).map((item) => item.id)).toEqual([
      "page-1"
    ]);
    expect((announcementsSnapshot.media as Array<Record<string, unknown>>).map((asset) => asset.id).sort()).toEqual([
      "media-announcement",
      "media-page"
    ]);
    expect(captureError(() => context.getPublicContentListSnapshot({ kind: "program" }))?.statusCode).toBe(400);
  });

  it("builds a public program list snapshot with only published programs and referenced media", () => {
    const context = loadCmsScript();
    context.readObjects.mockImplementation((_sheet: unknown, headers: string[]) => {
      if (headers === TEST_CONTENT_HEADERS) {
        return [
          {
            id: "program-1",
            title: "Published program",
            slug: "published-program",
            type: "program",
            status: "published",
            owner: "Admin",
            summary: "Visible program",
            body: "Body should not be in list payload",
            featuredMediaId: "media-program",
            updatedAt: "2026-05-04T00:00:00.000Z",
            publishAt: "2026-05-04T00:00:00.000Z"
          },
          {
            id: "program-draft",
            title: "Draft program",
            slug: "draft-program",
            type: "program",
            status: "draft",
            owner: "Admin",
            summary: "Hidden draft",
            featuredMediaId: "media-draft",
            updatedAt: "2026-05-05T00:00:00.000Z",
            publishAt: "2026-05-05T00:00:00.000Z"
          },
          {
            id: "news-1",
            title: "Published news",
            slug: "published-news",
            type: "news",
            status: "published",
            owner: "Admin",
            summary: "Not a program",
            featuredMediaId: "media-news",
            updatedAt: "2026-05-06T00:00:00.000Z",
            publishAt: "2026-05-06T00:00:00.000Z"
          }
        ];
      }

      if (headers === TEST_MEDIA_HEADERS) {
        return [
          {
            id: "media-program",
            name: "Program image",
            type: "image",
            driveUrl: "https://drive.google.com/file/d/media-program/view",
            previewUrl: "https://drive.google.com/thumbnail?id=media-program"
          },
          {
            id: "media-draft",
            name: "Draft image",
            type: "image",
            driveUrl: "https://drive.google.com/file/d/media-draft/view",
            previewUrl: "https://drive.google.com/thumbnail?id=media-draft"
          },
          {
            id: "media-news",
            name: "News image",
            type: "image",
            driveUrl: "https://drive.google.com/file/d/media-news/view",
            previewUrl: "https://drive.google.com/thumbnail?id=media-news"
          }
        ];
      }

      return [];
    });

    const snapshot = context.getPublicProgramListSnapshot();
    const items = snapshot.items as Array<Record<string, unknown>>;
    const media = snapshot.media as Array<Record<string, unknown>>;

    expect(items.map((item) => item.id)).toEqual(["program-1"]);
    expect(items[0]).not.toHaveProperty("body");
    expect(media.map((asset) => asset.id)).toEqual(["media-program"]);
    expect(snapshot).toHaveProperty("siteSettings");
    expect(snapshot).toHaveProperty("generatedAt");
  });

  it("builds a public search index with only published body-free content", () => {
    const context = loadCmsScript();
    context.readObjects.mockImplementation((_sheet: unknown, headers: string[]) => {
      if (headers === TEST_CONTENT_HEADERS) {
        return [
          {
            id: "news-1",
            title: "Published searchable news",
            slug: "published-searchable-news",
            type: "news",
            status: "published",
            owner: "Admin",
            summary: "Visible search summary",
            category: "Search category",
            tags: "search,public",
            seoTitle: "Search SEO",
            seoDescription: "Search description",
            featured: "TRUE",
            readingMinutes: "3",
            body: "Body should not be in search index",
            bodyDocId: "doc-id",
            bodyDocUrl: "https://docs.google.com/document/d/doc-id",
            featuredMediaId: "media-news",
            mediaIds: "media-extra",
            updatedAt: "2026-05-04T00:00:00.000Z",
            publishAt: "2026-05-04T00:00:00.000Z"
          },
          {
            id: "draft-news",
            title: "Draft hidden news",
            slug: "draft-hidden-news",
            type: "news",
            status: "draft",
            owner: "Admin",
            summary: "Hidden draft",
            updatedAt: "2026-05-05T00:00:00.000Z",
            publishAt: "2026-05-05T00:00:00.000Z"
          },
          {
            id: "review-page",
            title: "Review hidden page",
            slug: "review-hidden-page",
            type: "page",
            status: "review",
            owner: "Admin",
            summary: "Hidden review",
            updatedAt: "2026-05-06T00:00:00.000Z",
            publishAt: "2026-05-06T00:00:00.000Z"
          }
        ];
      }

      return [];
    });

    const snapshot = context.getPublicSearchIndexSnapshot();
    const items = snapshot.items as Array<Record<string, unknown>>;

    expect(items.map((item) => item.id)).toEqual(["news-1"]);
    expect(items[0]).toMatchObject({
      title: "Published searchable news",
      status: "published",
      owner: "Admin",
      summary: "Visible search summary",
      category: "Search category",
      tags: ["search", "public"],
      seoTitle: "Search SEO",
      seoDescription: "Search description",
      featured: true,
      readingMinutes: 3
    });
    expect(items[0]).not.toHaveProperty("body");
    expect(items[0]).not.toHaveProperty("bodyDocId");
    expect(items[0]).not.toHaveProperty("bodyDocUrl");
    expect(items[0]).not.toHaveProperty("mediaIds");
    expect(items[0]).not.toHaveProperty("featuredMediaId");
    expect(snapshot).not.toHaveProperty("media");
    expect(snapshot).not.toHaveProperty("events");
    expect(snapshot).toHaveProperty("siteSettings");
    expect(snapshot).toHaveProperty("generatedAt");
    expect(context.readObjects).toHaveBeenCalledTimes(1);
    expect(context.readObjects).toHaveBeenCalledWith(expect.anything(), TEST_CONTENT_HEADERS);
  });

  it("returns only visible public carousel slides sorted by order", () => {
    const context = loadCmsScript();
    context.readObjects.mockImplementation((_sheet: unknown, headers: string[]) => {
      if (headers === TEST_CAROUSEL_HEADERS) {
        return [
          {
            id: "hidden-disabled",
            title: "Disabled slide",
            imageUrl: "https://example.edu/disabled.jpg",
            enabled: "FALSE",
            order: "1",
            updatedAt: "2026-05-03T00:00:00.000Z"
          },
          {
            id: "visible-later",
            title: "Second slide",
            imageUrl: "https://example.edu/second.jpg",
            enabled: "TRUE",
            order: "2",
            updatedAt: "2026-05-05T00:00:00.000Z"
          },
          {
            id: "visible-first",
            title: "First slide",
            imageUrl: "https://example.edu/first.jpg",
            enabled: true,
            order: "1",
            updatedAt: "2026-05-04T00:00:00.000Z"
          },
          {
            id: "visible-image-only",
            title: "",
            imageUrl: "https://example.edu/image-only.jpg",
            enabled: true,
            order: "3",
            updatedAt: "2026-05-04T00:00:00.000Z"
          },
          {
            id: "hidden-future",
            title: "Future slide",
            imageUrl: "https://example.edu/future.jpg",
            enabled: "TRUE",
            order: "0",
            startAt: "2099-01-01T00:00:00.000Z",
            updatedAt: "2026-05-06T00:00:00.000Z"
          }
        ];
      }

      return [];
    });

    const slides = context.getCarouselSlides();

    expect(slides.map((slide) => slide.id)).toEqual(["visible-first", "visible-later", "visible-image-only"]);
    expect(slides[0]).toMatchObject({
      chip: "ประชาสัมพันธ์",
      buttonLabel: "อ่านต่อ",
      href: "/",
      enabled: true
    });
  });

  it("includes disabled carousel slides for admin snapshots", () => {
    const context = loadCmsScript();
    context.readObjects.mockImplementation((_sheet: unknown, headers: string[]) => {
      if (headers === TEST_CAROUSEL_HEADERS) {
        return [
          {
            id: "disabled-slide",
            title: "Disabled slide",
            imageUrl: "",
            enabled: "FALSE",
            order: "3",
            updatedAt: "2026-05-03T00:00:00.000Z"
          }
        ];
      }

      return [];
    });

    expect(context.getCarouselSlides({ includeDisabled: true })).toHaveLength(1);
    expect(context.getCarouselSlides({ includeDisabled: true })[0]).toMatchObject({
      id: "disabled-slide",
      enabled: false
    });
  });

  it("returns only visible public external services sorted by order", () => {
    const context = loadCmsScript();
    context.readObjects.mockImplementation((_sheet: unknown, headers: string[]) => {
      if (headers === TEST_EXTERNAL_SERVICE_HEADERS) {
        return [
          {
            id: "hidden-disabled",
            title: "Disabled service",
            href: "https://services.example.edu/disabled",
            enabled: "FALSE",
            order: "1",
            updatedAt: "2026-05-03T00:00:00.000Z"
          },
          {
            id: "visible-later",
            title: "Career service",
            href: "https://services.example.edu/career",
            tone: "career",
            iconKey: "handshake",
            enabled: "TRUE",
            order: "2",
            updatedAt: "2026-05-05T00:00:00.000Z"
          },
          {
            id: "visible-first",
            title: "Student service",
            href: "https://services.example.edu/student",
            tone: "unknown",
            iconKey: "unknown",
            enabled: true,
            order: "1",
            updatedAt: "2026-05-04T00:00:00.000Z"
          },
          {
            id: "hidden-empty-href",
            title: "Missing href",
            enabled: "TRUE",
            order: "0",
            updatedAt: "2026-05-06T00:00:00.000Z"
          }
        ];
      }

      return [];
    });

    const services = context.getExternalServices();

    expect(services.map((service) => service.id)).toEqual(["visible-first", "visible-later"]);
    expect(services[0]).toMatchObject({
      tone: "general",
      iconKey: "link",
      enabled: true
    });
  });

  it("includes disabled external services for admin snapshots", () => {
    const context = loadCmsScript();
    context.readObjects.mockImplementation((_sheet: unknown, headers: string[]) => {
      if (headers === TEST_EXTERNAL_SERVICE_HEADERS) {
        return [
          {
            id: "disabled-service",
            title: "Disabled service",
            href: "",
            enabled: "FALSE",
            order: "3",
            updatedAt: "2026-05-03T00:00:00.000Z"
          }
        ];
      }

      return [];
    });

    expect(context.getExternalServices({ includeDisabled: true })).toHaveLength(1);
    expect(context.getExternalServices({ includeDisabled: true })[0]).toMatchObject({
      id: "disabled-service",
      enabled: false
    });
  });

  it("drops unsafe public media URLs from legacy sheet records", () => {
    const context = loadCmsScript();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const media = context.sanitizePublicMediaRecord({
      id: "media-1",
      name: "Unsafe media",
      type: "video",
      driveUrl: "javascript:alert(1)",
      previewUrl: "https://evil.example/preview",
      embedUrl: "data:text/html,<script>alert(1)</script>"
    });

    expect(media.driveUrl).toBe("");
    expect(media.previewUrl).toBe("");
    expect(media.embedUrl).toBe("");
    warnSpy.mockRestore();
  });

  it("normalizes public media URLs by protocol and host allowlist", () => {
    const context = loadCmsScript();

    expect(context.normalizePublicMediaUrl("https://example.edu/file.pdf")).toBe("https://example.edu/file.pdf");
    expect(
      context.normalizePublicMediaUrl("https://drive.google.com/file/d/media-1/preview", ["drive.google.com"])
    ).toBe("https://drive.google.com/file/d/media-1/preview");
    expect(context.normalizePublicMediaUrl("https://www.youtube.com/embed/video-id", ["www.youtube.com"])).toBe(
      "https://www.youtube.com/embed/video-id"
    );

    expect(captureError(() => context.normalizePublicMediaUrl("http://example.edu/file.pdf"))?.statusCode).toBe(400);
    expect(captureError(() => context.normalizePublicMediaUrl("javascript:alert(1)"))?.statusCode).toBe(400);
    expect(captureError(() => context.normalizePublicMediaUrl("data:text/html,test"))?.statusCode).toBe(400);
    expect(captureError(() => context.normalizePublicMediaUrl("file:///tmp/file.pdf"))?.statusCode).toBe(400);
    expect(captureError(() => context.normalizePublicMediaUrl("blob:https://example.edu/id"))?.statusCode).toBe(400);
    expect(captureError(() => context.normalizePublicMediaUrl("vbscript:msgbox(1)"))?.statusCode).toBe(400);
    expect(
      captureError(() => context.normalizePublicMediaUrl("https://evil.example/preview", ["drive.google.com"]))
        ?.statusCode
    ).toBe(400);
  });

  it("allows expected upload MIME types and rejects unknown or oversized uploads", () => {
    const context = loadCmsScript();

    expect(context.isAllowedUploadMimeType("image/png")).toBe(true);
    expect(context.isAllowedUploadMimeType("video/mp4")).toBe(true);
    expect(context.isAllowedUploadMimeType("application/pdf")).toBe(true);
    expect(
      context.isAllowedUploadMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ).toBe(true);
    expect(context.isAllowedUploadMimeType("application/javascript")).toBe(false);
    expect(context.resolveUploadMimeType({ fileBase64: "data:text/csv;base64,YSxi" })).toBe("text/csv");

    expect(
      captureError(() => context.resolveUploadMimeType({ mimeType: "application/octet-stream" }))?.statusCode
    ).toBe(400);
    expect(captureError(() => context.validateUploadBytes({ length: 10 * 1024 * 1024 + 1 }))?.statusCode).toBe(413);
    expect(() => context.validateUploadBytes({ length: 10 * 1024 * 1024 })).not.toThrow();
  });
});
