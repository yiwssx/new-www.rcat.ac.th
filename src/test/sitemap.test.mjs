import { describe, expect, it } from "vitest";
import { buildSitemapUrls, createSitemapXml } from "../../scripts/generate-sitemap.mjs";

describe("sitemap generation", () => {
  it("includes static routes and published content only", () => {
    const urls = buildSitemapUrls({
      siteUrl: "https://school.example/",
      content: [
        { slug: "published-news", status: "published" },
        { slug: "draft-news", status: "draft" },
        { slug: "review-news", status: "review" },
        { slug: "scheduled-news", status: "scheduled" }
      ]
    });

    expect(urls).toContain("https://school.example/");
    expect(urls).toContain("https://school.example/news");
    expect(urls).toContain("https://school.example/content/published-news");
    expect(urls).toContain("https://school.example/published-news");
    expect(urls.join("\n")).not.toContain("draft-news");
    expect(urls.join("\n")).not.toContain("review-news");
    expect(urls.join("\n")).not.toContain("scheduled-news");
  });

  it("escapes generated XML URLs", () => {
    const xml = createSitemapXml(["https://school.example/content/news?a=1&b=2"], {
      lastmod: "2026-04-28"
    });

    expect(xml).toContain("<loc>https://school.example/content/news?a=1&amp;b=2</loc>");
    expect(xml).toContain("<lastmod>2026-04-28</lastmod>");
  });
});
