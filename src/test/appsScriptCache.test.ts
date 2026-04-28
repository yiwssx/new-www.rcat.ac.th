import { describe, expect, it, vi, type Mock } from "vitest";
import cacheSource from "../../apps-script/Cache.gs?raw";

interface CacheScriptContext {
  estimateUtf8Bytes: (value: string) => number;
  getPublicSnapshotCached: () => unknown;
  invalidatePublicSnapshotCache: () => void;
  getSnapshot: Mock;
  scriptCache: {
    get: Mock;
    put: Mock;
    remove: Mock;
  };
  store: Map<string, string>;
}

function loadCacheScript(snapshot: unknown = { content: [], media: [], events: [] }): CacheScriptContext {
  const store = new Map<string, string>();
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
  const getSnapshot = vi.fn(() => snapshot);
  const createScriptExports = new Function(
    "CacheService",
    "getSnapshot",
    "console",
    `${cacheSource}
return {
  estimateUtf8Bytes,
  getPublicSnapshotCached,
  invalidatePublicSnapshotCache
};`
  );
  const exports = createScriptExports(CacheService, getSnapshot, console) as Pick<
    CacheScriptContext,
    "estimateUtf8Bytes" | "getPublicSnapshotCached" | "invalidatePublicSnapshotCache"
  >;

  return {
    ...exports,
    getSnapshot,
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
    expect(context.scriptCache.put).toHaveBeenCalledWith(
      "cms:public:snapshot:v1",
      JSON.stringify(snapshot),
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

    context.invalidatePublicSnapshotCache();

    expect(context.scriptCache.remove).toHaveBeenCalledWith("cms:public:snapshot:v1");
    expect(context.store.has("cms:public:snapshot:v1")).toBe(false);
  });
});
