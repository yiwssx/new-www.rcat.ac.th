// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_NOT_FOUND_CDN_CACHE_CONTROL,
  PUBLIC_REDIRECT_CDN_CACHE_CONTROL,
  handleVercelPublicSsrRequest
} from "../vercelSsr";

const generatedAt = "2026-09-13T05:00:00.000Z";

describe("Vercel Public SSR runtime optimization", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.edu");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects obvious single-segment probes without touching the public API or React SSR", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleVercelPublicSsrRequest(new Request("https://www.rcat.ac.th/api/ssr?_rcatPath=/null"));

    expect(response.status).toBe(404);
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(PUBLIC_NOT_FOUND_CDN_CACHE_CONTROL);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves a valid legacy permalink with one detail lookup and no shell render", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      expect(url.pathname).toBe("/api/public/content/published-news");
      return Response.json({
        item: { id: "content-1", slug: "published-news", title: "Published", status: "published" },
        media: [],
        relatedItems: [],
        generatedAt
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleVercelPublicSsrRequest(
      new Request("https://www.rcat.ac.th/api/ssr?_rcatPath=/published-news")
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("/content/published-news");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(PUBLIC_REDIRECT_CDN_CACHE_CONTROL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("short-circuits unknown legacy permalinks to a short-lived CDN 404", async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: "Not found" }, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleVercelPublicSsrRequest(
      new Request("https://www.rcat.ac.th/api/ssr?_rcatPath=/missing-public-slug")
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(PUBLIC_NOT_FOUND_CDN_CACHE_CONTROL);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
