import { describe, expect, it, vi, type Mock } from "vitest";
import cacheSource from "../../apps-script/Cache.gs?raw";

interface CacheScriptContext {
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
  getPublicSnapshotCached,
  invalidatePublicSnapshotCache
};`
  );
  const exports = createScriptExports(CacheService, getSnapshot, console) as Pick<
    CacheScriptContext,
    "getPublicSnapshotCached" | "invalidatePublicSnapshotCache"
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

  it("invalidates the public snapshot cache", () => {
    const context = loadCacheScript();
    context.store.set("cms:public:snapshot:v1", JSON.stringify({ content: ["stale"] }));

    context.invalidatePublicSnapshotCache();

    expect(context.scriptCache.remove).toHaveBeenCalledWith("cms:public:snapshot:v1");
    expect(context.store.has("cms:public:snapshot:v1")).toBe(false);
  });
});
