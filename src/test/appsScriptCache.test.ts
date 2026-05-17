import { describe, expect, it, vi, type Mock } from "vitest";
import cacheSource from "../../apps-script/Cache.gs?raw";

interface CacheScriptContext {
  estimateUtf8Bytes: (value: string) => number;
  getPublicContentDetailCached: (query: Record<string, unknown>) => unknown;
  getPublicContentListSnapshotCached: (query: Record<string, unknown>) => unknown;
  getPublicHomeSnapshotCached: () => unknown;
  getPublicProgramListSnapshotCached: () => unknown;
  getPublicSearchIndexSnapshotCached: () => unknown;
  getPublicSnapshotCached: () => unknown;
  getContentDetail: Mock;
  getPublicContentListSnapshot: Mock;
  getPublicHomeSnapshot: Mock;
  getPublicProgramListSnapshot: Mock;
  getPublicSearchIndexSnapshot: Mock;
  invalidatePublicSnapshotCache: () => void;
  getSnapshot: Mock;
  scriptProperties: {
    getProperty: Mock;
    setProperty: Mock;
  };
  scriptCache: {
    get: Mock;
    put: Mock;
    remove: Mock;
  };
  store: Map<string, string>;
}

function loadCacheScript(snapshot: unknown = { content: [], media: [], events: [] }): CacheScriptContext {
  const store = new Map<string, string>();
  const propertyStore = new Map<string, string>([["cms:public:cache-version:v1", "1"]]);
  const scriptCache = {
    get: vi.fn((key: string) => store.get(key) ?? null),
    put: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    remove: vi.fn((key: string) => {
      store.delete(key);
    })
  };
  const CacheService = {
    getScriptCache: vi.fn(() => scriptCache)
  };
  const scriptProperties = {
    getProperty: vi.fn((key: string) => propertyStore.get(key) ?? null),
    setProperty: vi.fn((key: string, value: string) => {
      propertyStore.set(key, value);
    })
  };
  const PropertiesService = {
    getScriptProperties: vi.fn(() => scriptProperties)
  };
  const getSnapshot = vi.fn(() => snapshot);
  const getPublicHomeSnapshot = vi.fn(() => ({
    latestNews: [],
    generatedAt: "2026-05-12T00:00:00.000Z"
  }));
  const getPublicContentListSnapshot = vi.fn((query: Record<string, unknown>) => ({
    kind: query.kind || query.type || "news",
    items: [],
    generatedAt: "2026-05-12T00:00:00.000Z"
  }));
  const getPublicProgramListSnapshot = vi.fn(() => ({
    items: [],
    generatedAt: "2026-05-12T00:00:00.000Z"
  }));
  const getPublicSearchIndexSnapshot = vi.fn(() => ({
    items: [],
    generatedAt: "2026-05-12T00:00:00.000Z"
  }));
  const getContentDetail = vi.fn((query: Record<string, unknown>) => ({
    id: query.id || "content-1",
    slug: query.slug || "content-1",
    title: "Public content"
  }));
  const createScriptExports = new Function(
    "CacheService",
    "PropertiesService",
    "getSnapshot",
    "getPublicHomeSnapshot",
    "getPublicContentListSnapshot",
    "getPublicProgramListSnapshot",
    "getPublicSearchIndexSnapshot",
    "getContentDetail",
    "console",
    `${cacheSource}
return {
  estimateUtf8Bytes,
  getPublicContentDetailCached,
  getPublicContentListSnapshotCached,
  getPublicHomeSnapshotCached,
  getPublicProgramListSnapshotCached,
  getPublicSearchIndexSnapshotCached,
  getPublicSnapshotCached,
  invalidatePublicSnapshotCache
};`
  );
  const exports = createScriptExports(
    CacheService,
    PropertiesService,
    getSnapshot,
    getPublicHomeSnapshot,
    getPublicContentListSnapshot,
    getPublicProgramListSnapshot,
    getPublicSearchIndexSnapshot,
    getContentDetail,
    console
  ) as Pick<
    CacheScriptContext,
    | "estimateUtf8Bytes"
    | "getPublicContentDetailCached"
    | "getPublicContentListSnapshotCached"
    | "getPublicHomeSnapshotCached"
    | "getPublicProgramListSnapshotCached"
    | "getPublicSearchIndexSnapshotCached"
    | "getPublicSnapshotCached"
    | "invalidatePublicSnapshotCache"
  >;

  return {
    ...exports,
    getContentDetail,
    getPublicContentListSnapshot,
    getPublicHomeSnapshot,
    getPublicProgramListSnapshot,
    getPublicSearchIndexSnapshot,
    getSnapshot,
    scriptProperties,
    scriptCache,
    store
  };
}

describe("Apps Script public cache helpers", () => {
  it("caches public snapshots in CacheService", () => {
    const snapshot = { content: [{ id: "content-1" }], media: [], events: [] };
    const context = loadCacheScript(snapshot);

    expect(context.getPublicSnapshotCached()).toEqual(snapshot);
    expect(context.getPublicSnapshotCached()).toEqual(snapshot);
    expect(context.getSnapshot).toHaveBeenCalledTimes(1);
    expect(context.scriptCache.put).toHaveBeenCalledWith("cms:public:snapshot:v1", JSON.stringify(snapshot), 300);
  });

  it("caches public home, program list, and search index snapshots", () => {
    const context = loadCacheScript();

    expect(context.getPublicHomeSnapshotCached()).toEqual({
      latestNews: [],
      generatedAt: "2026-05-12T00:00:00.000Z"
    });
    expect(context.getPublicHomeSnapshotCached()).toEqual({
      latestNews: [],
      generatedAt: "2026-05-12T00:00:00.000Z"
    });
    expect(context.getPublicProgramListSnapshotCached()).toEqual({
      items: [],
      generatedAt: "2026-05-12T00:00:00.000Z"
    });
    expect(context.getPublicProgramListSnapshotCached()).toEqual({
      items: [],
      generatedAt: "2026-05-12T00:00:00.000Z"
    });
    expect(context.getPublicSearchIndexSnapshotCached()).toEqual({
      items: [],
      generatedAt: "2026-05-12T00:00:00.000Z"
    });
    expect(context.getPublicSearchIndexSnapshotCached()).toEqual({
      items: [],
      generatedAt: "2026-05-12T00:00:00.000Z"
    });

    expect(context.getPublicHomeSnapshot).toHaveBeenCalledTimes(1);
    expect(context.getPublicProgramListSnapshot).toHaveBeenCalledTimes(1);
    expect(context.getPublicSearchIndexSnapshot).toHaveBeenCalledTimes(1);
    expect(context.scriptCache.put).toHaveBeenCalledWith(
      "cms:public:home:v1",
      JSON.stringify({
        latestNews: [],
        generatedAt: "2026-05-12T00:00:00.000Z"
      }),
      300
    );
    expect(context.scriptCache.put).toHaveBeenCalledWith(
      "cms:public:program-list:v1",
      JSON.stringify({
        items: [],
        generatedAt: "2026-05-12T00:00:00.000Z"
      }),
      300
    );
    expect(context.scriptCache.put).toHaveBeenCalledWith(
      "cms:public:search-index:v1",
      JSON.stringify({
        items: [],
        generatedAt: "2026-05-12T00:00:00.000Z"
      }),
      300
    );
  });

  it("caches public content lists separately by normalized kind", () => {
    const context = loadCacheScript();

    expect(context.getPublicContentListSnapshotCached({ kind: "news" })).toMatchObject({ kind: "news" });
    expect(context.getPublicContentListSnapshotCached({ kind: "news" })).toMatchObject({ kind: "news" });
    expect(context.getPublicContentListSnapshotCached({ type: "announcements" })).toMatchObject({
      kind: "announcements"
    });
    expect(context.getPublicContentListSnapshotCached({ type: "announcements" })).toMatchObject({
      kind: "announcements"
    });
    expect(context.getPublicContentListSnapshotCached({ kind: "blog" })).toMatchObject({ kind: "blog" });

    expect(context.getPublicContentListSnapshot).toHaveBeenCalledTimes(3);
    expect(context.scriptCache.put).toHaveBeenCalledWith("cms:public:content-list:v1:news", expect.any(String), 300);
    expect(context.scriptCache.put).toHaveBeenCalledWith(
      "cms:public:content-list:v1:announcements",
      expect.any(String),
      300
    );
    expect(context.scriptCache.put).toHaveBeenCalledWith("cms:public:content-list:v1:blog", expect.any(String), 300);
  });

  it("falls back to live public content list handling for invalid kinds", () => {
    const context = loadCacheScript();

    expect(context.getPublicContentListSnapshotCached({ kind: "invalid" })).toMatchObject({ kind: "invalid" });

    expect(context.getPublicContentListSnapshot).toHaveBeenCalledWith({ kind: "invalid" });
    expect(context.scriptCache.put).not.toHaveBeenCalledWith(
      "cms:public:content-list:v1:invalid",
      expect.any(String),
      300
    );
  });

  it("caches public content detail by public lookup key", () => {
    const context = loadCacheScript();

    expect(context.getPublicContentDetailCached({ slug: "announcement-1" })).toMatchObject({
      slug: "announcement-1"
    });
    expect(context.getPublicContentDetailCached({ slug: "announcement-1" })).toMatchObject({
      slug: "announcement-1"
    });
    expect(context.getPublicContentDetailCached({ id: "content-1" })).toMatchObject({
      id: "content-1"
    });

    expect(context.getContentDetail).toHaveBeenCalledTimes(2);
    expect(context.getContentDetail).toHaveBeenCalledWith(
      { slug: "announcement-1" },
      {
        includeUnpublished: false
      }
    );
    expect(context.scriptCache.put).toHaveBeenCalledWith(
      "cms:public:content-detail:v1:1:slug:announcement-1",
      expect.any(String),
      300
    );
    expect(context.scriptCache.put).toHaveBeenCalledWith(
      "cms:public:content-detail:v1:1:id:content-1",
      expect.any(String),
      300
    );
  });

  it("skips oversized public snapshots without throwing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const oversizedSnapshot = {
      content: [
        {
          id: "content-1",
          title: "Large content",
          summary: "x".repeat(98 * 1024)
        }
      ],
      media: [],
      events: []
    };
    const context = loadCacheScript(oversizedSnapshot);

    expect(() => context.getPublicSnapshotCached()).not.toThrow();
    expect(context.getPublicSnapshotCached()).toEqual(oversizedSnapshot);
    expect(context.getSnapshot).toHaveBeenCalledTimes(2);
    expect(context.scriptCache.put).not.toHaveBeenCalled();
    expect(context.store.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping cache write for cms:public:snapshot:v1"));
    warnSpy.mockRestore();
  });

  it("estimates multibyte payload size before cache writes", () => {
    const context = loadCacheScript();

    expect(context.estimateUtf8Bytes("abc")).toBe(3);
    expect(context.estimateUtf8Bytes("ภาษาไทย")).toBeGreaterThan("ภาษาไทย".length);
  });

  it("invalidates the public snapshot cache", () => {
    const context = loadCacheScript();
    context.store.set("cms:public:snapshot:v1", JSON.stringify({ content: ["stale"] }));
    context.store.set("cms:public:home:v1", JSON.stringify({ latestNews: ["stale"] }));
    context.store.set("cms:public:program-list:v1", JSON.stringify({ items: ["stale"] }));
    context.store.set("cms:public:search-index:v1", JSON.stringify({ items: ["stale"] }));
    context.store.set("cms:public:content-list:v1:news", JSON.stringify({ items: ["stale"] }));
    context.store.set("cms:public:content-list:v1:announcements", JSON.stringify({ items: ["stale"] }));
    context.store.set("cms:public:content-list:v1:blog", JSON.stringify({ items: ["stale"] }));

    context.invalidatePublicSnapshotCache();

    expect(context.scriptCache.remove).toHaveBeenCalledWith("cms:public:snapshot:v1");
    expect(context.scriptCache.remove).toHaveBeenCalledWith("cms:public:home:v1");
    expect(context.scriptCache.remove).toHaveBeenCalledWith("cms:public:program-list:v1");
    expect(context.scriptCache.remove).toHaveBeenCalledWith("cms:public:search-index:v1");
    expect(context.scriptCache.remove).toHaveBeenCalledWith("cms:public:content-list:v1:news");
    expect(context.scriptCache.remove).toHaveBeenCalledWith("cms:public:content-list:v1:announcements");
    expect(context.scriptCache.remove).toHaveBeenCalledWith("cms:public:content-list:v1:blog");
    expect(context.scriptProperties.setProperty).toHaveBeenCalledWith(
      "cms:public:cache-version:v1",
      expect.any(String)
    );
    expect(context.store.has("cms:public:snapshot:v1")).toBe(false);
    expect(context.store.has("cms:public:home:v1")).toBe(false);
    expect(context.store.has("cms:public:program-list:v1")).toBe(false);
    expect(context.store.has("cms:public:search-index:v1")).toBe(false);
    expect(context.store.has("cms:public:content-list:v1:news")).toBe(false);
    expect(context.store.has("cms:public:content-list:v1:announcements")).toBe(false);
    expect(context.store.has("cms:public:content-list:v1:blog")).toBe(false);
  });
});
