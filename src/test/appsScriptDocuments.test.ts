import { describe, expect, it, vi, type Mock } from "vitest";
import cmsSource from "../../apps-script/Cms.gs?raw";

interface HttpError extends Error {
  statusCode?: number;
}

interface DocumentsScriptContext {
  deleteDocument: (id: string) => { id: string; deleted: boolean };
  getPublicDocumentListSnapshot: () => Record<string, unknown>;
  getPublicHomeSnapshot: () => Record<string, unknown>;
  normalizeDocumentRecord: (
    item: Record<string, unknown>,
    fallback?: Record<string, unknown>
  ) => Record<string, unknown>;
  sanitizePublicDocumentRecord: (item: Record<string, unknown>) => Record<string, unknown>;
  upsertDocument: (item: Record<string, unknown>) => Record<string, unknown>;
  deleteRowById: Mock;
  documentSheet: Record<string, unknown>;
  findRowById: Mock;
  invalidatePublicSnapshotCache: Mock;
  readObjects: Mock;
  upsertRow: Mock;
}

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

function createHttpError(message: string, statusCode: number) {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  return error;
}

function validateRequired(value: Record<string, unknown>, keys: string[]) {
  keys.forEach((key) => {
    if (!value[key]) {
      throw new Error(`Missing required field: ${key}`);
    }
  });
}

function loadDocumentsScript(
  input: { documents?: Array<Record<string, unknown>>; content?: Array<Record<string, unknown>> } = {}
) {
  const documentSheet = {
    getName: () => "Documents"
  };
  const contentSheet = {
    getName: () => "Content"
  };
  const mediaSheet = {
    getName: () => "Media"
  };
  const eventsSheet = {
    getName: () => "Events"
  };
  const getSpreadsheet = vi.fn(() => ({
    getSheetByName: vi.fn((name: string) => {
      if (name === "Documents") {
        return documentSheet;
      }

      if (name === "Content") {
        return contentSheet;
      }

      if (name === "Media") {
        return mediaSheet;
      }

      if (name === "Events") {
        return eventsSheet;
      }

      return {
        getName: () => name
      };
    })
  }));
  const readObjects = vi.fn((_sheet: unknown, headers: string[]) => {
    if (headers === TEST_DOCUMENT_HEADERS) {
      return input.documents ?? [];
    }

    if (headers === TEST_CONTENT_HEADERS) {
      return input.content ?? [];
    }

    return [];
  });
  const upsertRow = vi.fn();
  const deleteRowById = vi.fn();
  const findRowById = vi.fn(() => null);
  const invalidatePublicSnapshotCache = vi.fn();
  const createScriptExports = new Function(
    "console",
    "createHttpError",
    "getSpreadsheet",
    "ensureSheet",
    "readObjects",
    "upsertRow",
    "deleteRowById",
    "findRowById",
    "validateRequired",
    "invalidatePublicSnapshotCache",
    "getMenu",
    "getDisplaySettings",
    "getSiteSettings",
    "getHomepageSettings",
    "getVisitorStats",
    "CONTENT_HEADERS",
    "MEDIA_HEADERS",
    "CAROUSEL_HEADERS",
    "EXTERNAL_SERVICE_HEADERS",
    "EVENT_HEADERS",
    "DOCUMENT_HEADERS",
    "SHEETS",
    `${cmsSource}
return {
  deleteDocument,
  getPublicDocumentListSnapshot,
  getPublicHomeSnapshot,
  normalizeDocumentRecord,
  sanitizePublicDocumentRecord,
  upsertDocument
};`
  );
  const exports = createScriptExports(
    console,
    createHttpError,
    getSpreadsheet,
    vi.fn((_: unknown, __: string, ___: string[]) => documentSheet),
    readObjects,
    upsertRow,
    deleteRowById,
    findRowById,
    validateRequired,
    invalidatePublicSnapshotCache,
    vi.fn(() => []),
    vi.fn(() => ({ dateFormat: "D MMM BBBB", timeMode: "24h" })),
    vi.fn(() => ({ siteName: "Public site" })),
    vi.fn(() => ({})),
    vi.fn(() => ({ enabled: false })),
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
  ) as Omit<
    DocumentsScriptContext,
    "deleteRowById" | "documentSheet" | "findRowById" | "invalidatePublicSnapshotCache" | "readObjects" | "upsertRow"
  >;

  return {
    ...exports,
    deleteRowById,
    documentSheet,
    findRowById,
    invalidatePublicSnapshotCache,
    readObjects,
    upsertRow
  };
}

describe("Apps Script public documents", () => {
  it("normalizes document records for admin editing", () => {
    const context = loadDocumentsScript();

    expect(
      context.normalizeDocumentRecord({
        id: "document-1",
        title: "  ITA report  ",
        description: "  Public report  ",
        category: "ITA, ITA, Reports",
        fileUrl: "https://example.edu/ita.pdf",
        fileName: "  ita.pdf  ",
        mediaId: " media-1 ",
        publishedAt: "2026-05-04T00:00:00.000Z",
        status: "PUBLISHED",
        order: "2",
        pinned: "TRUE",
        updatedAt: "2026-05-05T00:00:00.000Z"
      })
    ).toMatchObject({
      id: "document-1",
      title: "ITA report",
      description: "Public report",
      category: "ITA, Reports",
      fileUrl: "https://example.edu/ita.pdf",
      fileName: "ita.pdf",
      mediaId: "media-1",
      status: "published",
      order: 2,
      pinned: true
    });
  });

  it("returns only published public documents sorted by pinned, order, and published date", () => {
    const context = loadDocumentsScript({
      documents: [
        {
          id: "draft",
          title: "Draft document",
          fileUrl: "https://example.edu/draft.pdf",
          status: "draft",
          order: "1",
          pinned: "TRUE",
          publishedAt: "2026-05-09T00:00:00.000Z"
        },
        {
          id: "regular-newer",
          title: "Regular newer",
          fileUrl: "https://example.edu/newer.pdf",
          status: "published",
          order: "2",
          pinned: "FALSE",
          publishedAt: "2026-05-07T00:00:00.000Z",
          statusNote: "private"
        },
        {
          id: "pinned-later-order",
          title: "Pinned later order",
          fileUrl: "https://example.edu/pinned-later.pdf",
          status: "published",
          order: "5",
          pinned: "TRUE",
          publishedAt: "2026-05-08T00:00:00.000Z"
        },
        {
          id: "pinned-first-order",
          title: "Pinned first order",
          fileUrl: "https://example.edu/pinned-first.pdf",
          status: "published",
          order: "1",
          pinned: "TRUE",
          publishedAt: "2026-05-01T00:00:00.000Z"
        },
        {
          id: "regular-older",
          title: "Regular older",
          fileUrl: "https://example.edu/older.pdf",
          status: "published",
          order: "2",
          pinned: "FALSE",
          publishedAt: "2026-05-01T00:00:00.000Z"
        }
      ]
    });

    const snapshot = context.getPublicDocumentListSnapshot();
    const items = snapshot.items as Array<Record<string, unknown>>;

    expect(items.map((item) => item.id)).toEqual([
      "pinned-first-order",
      "pinned-later-order",
      "regular-newer",
      "regular-older"
    ]);
    expect(items[0]).toEqual({
      id: "pinned-first-order",
      title: "Pinned first order",
      description: "",
      category: "",
      fileUrl: "https://example.edu/pinned-first.pdf",
      fileName: "",
      mediaId: "",
      publishedAt: "2026-05-01T00:00:00.000Z",
      order: 1,
      pinned: true,
      updatedAt: ""
    });
    expect(items[2]).not.toHaveProperty("status");
    expect(items[2]).not.toHaveProperty("statusNote");
    expect(snapshot).toHaveProperty("generatedAt");
  });

  it("uses dedicated documents on public-home and falls back to keyword pages only while empty", () => {
    const dedicatedContext = loadDocumentsScript({
      documents: [
        {
          id: "document-1",
          title: "Managed document",
          fileUrl: "https://example.edu/managed.pdf",
          status: "published",
          order: "1",
          pinned: "TRUE",
          publishedAt: "2026-05-04T00:00:00.000Z"
        }
      ],
      content: [
        {
          id: "legacy-page",
          title: "Legacy keyword page",
          slug: "legacy-keyword-page",
          type: "page",
          status: "published",
          category: "เอกสาร",
          publishAt: "2026-05-05T00:00:00.000Z"
        }
      ]
    });
    const dedicatedHome = dedicatedContext.getPublicHomeSnapshot();

    expect((dedicatedHome.documentItems as Array<Record<string, unknown>>).map((item) => item.id)).toEqual([
      "document-1"
    ]);

    const fallbackContext = loadDocumentsScript({
      documents: [],
      content: [
        {
          id: "legacy-page",
          title: "Legacy keyword page",
          slug: "legacy-keyword-page",
          type: "page",
          status: "published",
          category: "เอกสาร",
          publishAt: "2026-05-05T00:00:00.000Z"
        }
      ]
    });
    const fallbackHome = fallbackContext.getPublicHomeSnapshot();

    expect((fallbackHome.documentItems as Array<Record<string, unknown>>).map((item) => item.id)).toEqual([
      "legacy-page"
    ]);
  });

  it("saves and deletes admin documents while invalidating public caches", () => {
    const context = loadDocumentsScript();
    const saved = context.upsertDocument({
      title: "Policy document",
      description: "Public policy",
      category: "Policy",
      fileUrl: "https://example.edu/policy.pdf",
      fileName: "policy.pdf",
      mediaId: "media-1",
      publishedAt: "2026-05-04T00:00:00.000Z",
      status: "published",
      order: "3",
      pinned: true
    });

    expect(saved).toMatchObject({
      title: "Policy document",
      status: "published",
      order: 3,
      pinned: true
    });
    expect(context.upsertRow).toHaveBeenCalledWith(
      context.documentSheet,
      TEST_DOCUMENT_HEADERS,
      expect.objectContaining({
        title: "Policy document",
        fileUrl: "https://example.edu/policy.pdf",
        status: "published",
        order: 3,
        pinned: "TRUE"
      })
    );
    expect(context.invalidatePublicSnapshotCache).toHaveBeenCalledTimes(1);

    expect(context.deleteDocument("document-1")).toEqual({
      id: "document-1",
      deleted: true
    });
    expect(context.deleteRowById).toHaveBeenCalledWith("Documents", TEST_DOCUMENT_HEADERS, "document-1");
    expect(context.invalidatePublicSnapshotCache).toHaveBeenCalledTimes(2);
  });
});
