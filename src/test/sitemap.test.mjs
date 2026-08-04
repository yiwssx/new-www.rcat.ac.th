import { describe, expect, it } from "vitest";
import {
  STATIC_INDEXABLE_ROUTES,
  buildSitemapUrls,
  createSitemapXml,
  getPublishedContentSitemapRoute,
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

    expect(urls).toContain("https://school.example/content/published-news");
    expect(urls).not.toContain("https://school.example/published-news");
    expect(urls.join("\n")).not.toContain("draft-news");
    expect(urls.join("\n")).not.toContain("/search");
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
