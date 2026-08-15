import { URL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  STATIC_INDEXABLE_ROUTES,
  buildSitemapUrls,
  createSitemapXml,
  createStaticSitemapXml,
  getPublishedContentSitemapRoute,
  loadSitemapData,
  normalizeInternalRoute
} from "../../api/sitemap.mjs";

describe("runtime sitemap generation", () => {
  it("includes every indexable static route and only canonical published content URLs", () => {
    const urls = buildSitemapUrls({
      siteUrl: "https://school.example/",
      content: [
        { slug: "published-news", status: "published" },
        { slug: "draft-news", status: "draft" }
      ]
    });

    for (const route of STATIC_INDEXABLE_ROUTES) {
      const expected = route === "/" ? "https://school.example/" : `https://school.example${route}`;
      expect(urls).toContain(expected);
    }

    expect(STATIC_INDEXABLE_ROUTES).toContain("/ita2569");
    expect(urls).toContain("https://school.example/ita2569");
    expect(urls).toContain("https://school.example/content/published-news");
    expect(urls).not.toContain("https://school.example/published-news");
    expect(urls.join("\n")).not.toContain("draft-news");
    expect(urls.join("\n")).not.toContain("/search");
  });

  it("builds a crawler-safe static sitemap when the public API is unavailable", () => {
    const xml = createStaticSitemapXml("https://www.rcat.ac.th/");

    for (const route of STATIC_INDEXABLE_ROUTES) {
      const expected = route === "/" ? "https://www.rcat.ac.th/" : `https://www.rcat.ac.th${route}`;
      expect(xml).toContain(`<loc>${expected}</loc>`);
    }

    expect(xml).not.toContain("/complaint");
    expect(xml).not.toContain("/search");
    expect(xml).not.toContain("/content/");
  });

  it("loads only real content and paginates all announcement page items", async () => {
    const requestedUrls = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      requestedUrls.push(url);
      const parsed = new URL(url);
      const kind = parsed.searchParams.get("kind");
      const pagesPage = Number(parsed.searchParams.get("pagesPage") || 0);

      if (kind === "announcements") {
        return {
          ok: true,
          json: async () => ({
            items: [{ slug: "announcement-item", status: "published" }],
            pageItems: [{ slug: `page-${pagesPage}`, status: "published" }],
            pageItemsPagination: { page: pagesPage, pageSize: 100, totalItems: 200, totalPages: 2 }
          })
        };
      }

      return {
        ok: true,
        json: async () => ({
          items: [{ slug: `${kind}-item`, status: "published" }]
        })
      };
    });

    try {
      const data = await loadSitemapData("https://api.school.example/");

      expect(requestedUrls.some((url) => url.includes("/programs"))).toBe(false);
      expect(requestedUrls).toContain("https://api.school.example/api/public/content?kind=news");
      expect(requestedUrls).toContain(
        "https://api.school.example/api/public/content?kind=announcements&pagesPage=1&pagesPageSize=100"
      );
      expect(requestedUrls).toContain(
        "https://api.school.example/api/public/content?kind=announcements&pagesPage=2&pagesPageSize=100"
      );
      expect(requestedUrls).toContain("https://api.school.example/api/public/content?kind=blog");
      expect(data.content.map((item) => item.slug)).toEqual([
        "news-item",
        "announcement-item",
        "page-1",
        "page-2",
        "blog-item"
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("excludes locally hosted content when CMS declares an external canonical URL", () => {
    expect(
      getPublishedContentSitemapRoute(
        {
          slug: "syndicated-news",
          status: "published",
          canonicalUrl: "https://publisher.example/story/syndicated-news"
        },
        "https://www.rcat.ac.th"
      )
    ).toBe("");
  });

  it("keeps same-site content in the canonical /content namespace", () => {
    expect(
      getPublishedContentSitemapRoute(
        {
          slug: "same-site-news",
          status: "published",
          canonicalUrl: "/same-site-news"
        },
        "https://www.rcat.ac.th"
      )
    ).toBe("/content/same-site-news");
  });

  it("excludes external, administrative, API, auth, search, contact protocol, and fragment links", () => {
    const siteUrl = "https://www.rcat.ac.th";

    expect(normalizeInternalRoute("https://facebook.com/rcat", siteUrl)).toBe("");
    expect(normalizeInternalRoute("/admin/users", siteUrl)).toBe("");
    expect(normalizeInternalRoute("/api/public/home", siteUrl)).toBe("");
    expect(normalizeInternalRoute("/login", siteUrl)).toBe("");
    expect(normalizeInternalRoute("/activate-account", siteUrl)).toBe("");
    expect(normalizeInternalRoute("/reset-password", siteUrl)).toBe("");
    expect(normalizeInternalRoute("/search?q=เกษตร", siteUrl)).toBe("");
    expect(normalizeInternalRoute("mailto:test@rcat.ac.th", siteUrl)).toBe("");
    expect(normalizeInternalRoute("tel:043569117", siteUrl)).toBe("");
    expect(normalizeInternalRoute("#contact", siteUrl)).toBe("");
  });

  it("accepts absolute URLs on the same apex domain", () => {
    expect(normalizeInternalRoute("https://rcat.ac.th/about", "https://www.rcat.ac.th")).toBe("/about");
  });

  it("removes query strings and fragments from normalized internal routes", () => {
    expect(normalizeInternalRoute("/news?page=2#latest", "https://www.rcat.ac.th")).toBe("/news");
  });

  it("escapes generated XML URLs", () => {
    const xml = createSitemapXml(["https://school.example/content/news?a=1&b=2"]);

    expect(xml).toContain("<loc>https://school.example/content/news?a=1&amp;b=2</loc>");
  });
});
