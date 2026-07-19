import { describe, expect, it } from "vitest";
import { buildSitemapUrls, createSitemapXml, normalizeInternalRoute } from "../../api/sitemap.mjs";

describe("runtime sitemap generation", () => {
  it("includes static routes, published content, and enabled nested menu routes", () => {
    const urls = buildSitemapUrls({
      siteUrl: "https://school.example/",
      menu: [
        {
          id: "about",
          label: "เกี่ยวกับเรา",
          href: "/about",
          enabled: true,
          children: [
            {
              id: "history",
              label: "ประวัติ",
              href: "/about/history",
              enabled: true
            }
          ]
        },
        {
          id: "disabled",
          label: "ปิดใช้งาน",
          href: "/disabled",
          enabled: false
        }
      ],
      content: [
        { slug: "published-news", status: "published" },
        { slug: "draft-news", status: "draft" }
      ]
    });

    expect(urls).toContain("https://school.example/");
    expect(urls).toContain("https://school.example/news");
    expect(urls).toContain("https://school.example/about");
    expect(urls).toContain("https://school.example/about/history");
    expect(urls).toContain("https://school.example/content/published-news");
    expect(urls).toContain("https://school.example/published-news");
    expect(urls.join("\n")).not.toContain("/disabled");
    expect(urls.join("\n")).not.toContain("draft-news");
  });

  it("excludes external, administrative, API, contact protocol, and fragment links", () => {
    const siteUrl = "https://www.rcat.ac.th";

    expect(normalizeInternalRoute("https://facebook.com/rcat", siteUrl)).toBe("");
    expect(normalizeInternalRoute("/admin/users", siteUrl)).toBe("");
    expect(normalizeInternalRoute("/api/public/home", siteUrl)).toBe("");
    expect(normalizeInternalRoute("mailto:test@rcat.ac.th", siteUrl)).toBe("");
    expect(normalizeInternalRoute("tel:043569117", siteUrl)).toBe("");
    expect(normalizeInternalRoute("#contact", siteUrl)).toBe("");
  });

  it("accepts absolute URLs on the same apex domain", () => {
    expect(normalizeInternalRoute("https://rcat.ac.th/about", "https://www.rcat.ac.th")).toBe("/about");
  });

  it("removes query strings and fragments from canonical menu routes", () => {
    expect(normalizeInternalRoute("/news?page=2#latest", "https://www.rcat.ac.th")).toBe("/news");
  });

  it("escapes generated XML URLs", () => {
    const xml = createSitemapXml(["https://school.example/content/news?a=1&b=2"]);

    expect(xml).toContain("<loc>https://school.example/content/news?a=1&amp;b=2</loc>");
  });
});
