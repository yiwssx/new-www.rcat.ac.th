// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sitemap, { resetSitemapRuntimeCacheForTests } from "../../api/sitemap.mjs";

function createResponseRecorder() {
  const headers = new Map();
  const recorder = {
    statusCode: 0,
    body: "",
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
    status(code) {
      recorder.statusCode = code;
      return recorder;
    },
    end(value = "") {
      recorder.body = String(value ?? "");
      return recorder;
    }
  };
  return recorder;
}

function createRequest(method = "GET") {
  return {
    method,
    headers: {
      host: "www.rcat.ac.th",
      "x-forwarded-proto": "https"
    }
  };
}

describe("runtime sitemap cache and degradation", () => {
  beforeEach(() => {
    resetSitemapRuntimeCacheForTests();
    vi.stubEnv("PUBLIC_SITE_URL", "https://www.rcat.ac.th");
    vi.stubEnv("CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.edu");
  });

  afterEach(() => {
    resetSitemapRuntimeCacheForTests();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reuses a fresh in-process sitemap and emits dedicated Vercel CDN cache policy", async () => {
    const fetchMock = vi.fn(async (input) => {
      const url = new URL(String(input));
      const kind = url.searchParams.get("kind");

      if (kind === "announcements") {
        return Response.json({
          items: [{ slug: "announcement", status: "published" }],
          pageItems: [],
          pageItemsPagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 1 }
        });
      }

      return Response.json({ items: [{ slug: `${kind}-item`, status: "published" }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = createResponseRecorder();
    await sitemap(createRequest(), first);
    const firstFetchCount = fetchMock.mock.calls.length;

    const second = createResponseRecorder();
    await sitemap(createRequest(), second);

    expect(first.statusCode).toBe(200);
    expect(first.getHeader("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(first.getHeader("vercel-cdn-cache-control")).toContain("max-age=600");
    expect(first.getHeader("x-rcat-sitemap-mode")).toBe("live");
    expect(second.getHeader("x-rcat-sitemap-mode")).toBe("memory-cache");
    expect(fetchMock).toHaveBeenCalledTimes(firstFetchCount);
    expect(second.body).toContain("/content/news-item");
  });

  it("returns a cacheable static fallback instead of propagating an upstream 503", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "unavailable" }, { status: 503 })));

    const response = createResponseRecorder();
    await sitemap(createRequest(), response);

    expect(response.statusCode).toBe(200);
    expect(response.getHeader("x-rcat-sitemap-mode")).toBe("static-fallback");
    expect(response.getHeader("vercel-cdn-cache-control")).toContain("max-age=60");
    expect(response.body).toContain("<urlset");
    expect(response.body).toContain("https://www.rcat.ac.th/news");
  });
});
