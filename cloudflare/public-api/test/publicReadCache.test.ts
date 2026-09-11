import { afterEach, describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { isPublicReadCacheEligible, readPublicReadCache, storePublicReadCache } from "../src/publicReadCache";

const originalCachesDescriptor = Object.getOwnPropertyDescriptor(globalThis, "caches");

function installFakeCache() {
  const entries = new Map<string, Response>();
  const cache = {
    async match(request: Request) {
      return entries.get(request.url)?.clone();
    },
    async put(request: Request, response: Response) {
      entries.set(request.url, response.clone());
    }
  } as unknown as Cache;

  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: { default: cache }
  });

  return entries;
}

afterEach(() => {
  if (originalCachesDescriptor) {
    Object.defineProperty(globalThis, "caches", originalCachesDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "caches");
  }
});

describe("public D1 read cache", () => {
  const productionEnv = { ENVIRONMENT: "production" } as Env;

  it("only enables cache for bounded production public GET routes", () => {
    expect(isPublicReadCacheEligible(new Request("https://worker.test/api/public/home"), productionEnv)).toBe(true);
    expect(isPublicReadCacheEligible(new Request("https://worker.test/api/public/visitor-stats"), productionEnv)).toBe(
      true
    );
    expect(
      isPublicReadCacheEligible(new Request("https://worker.test/api/public/content/example"), productionEnv)
    ).toBe(false);
    expect(
      isPublicReadCacheEligible(
        new Request("https://worker.test/api/public/home", { headers: { "Cache-Control": "no-cache" } }),
        productionEnv
      )
    ).toBe(false);
    expect(
      isPublicReadCacheEligible(new Request("https://worker.test/api/public/home"), { ENVIRONMENT: "preview" } as Env)
    ).toBe(false);
  });

  it("stores a successful response and serves the next identical URL from cache", async () => {
    const entries = installFakeCache();
    const request = new Request("https://worker.test/api/public/home?locale=th");
    const pending: Promise<unknown>[] = [];
    const context = {
      waitUntil(promise: Promise<unknown>) {
        pending.push(promise);
      }
    } as unknown as ExecutionContext;

    storePublicReadCache(request, productionEnv, new Response(JSON.stringify({ ok: true }), { status: 200 }), context);
    await Promise.all(pending);

    expect(entries.size).toBe(1);
    const cached = await readPublicReadCache(request, productionEnv);
    expect(cached?.status).toBe(200);
    await expect(cached?.json()).resolves.toEqual({ ok: true });
    expect(cached?.headers.get("Cache-Control")).toBe("public, s-maxage=900");
  });

  it("never stores failed public reads", async () => {
    const entries = installFakeCache();
    const request = new Request("https://worker.test/api/public/visitor-stats");
    const pending: Promise<unknown>[] = [];
    const context = {
      waitUntil(promise: Promise<unknown>) {
        pending.push(promise);
      }
    } as unknown as ExecutionContext;

    storePublicReadCache(request, productionEnv, new Response("unavailable", { status: 503 }), context);
    await Promise.all(pending);

    expect(entries.size).toBe(0);
    await expect(readPublicReadCache(request, productionEnv)).resolves.toBeNull();
  });
});
