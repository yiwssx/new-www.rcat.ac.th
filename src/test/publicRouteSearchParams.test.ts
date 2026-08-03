import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  normalizePublicPageSearchValue,
  validatePublicAnnouncementsSearch,
  validatePublicFilteredPaginatedSearch,
  validatePublicPaginatedSearch,
  validatePublicSearchRouteSearch
} from "../public/routing/searchParams";

describe("public route search params", () => {
  it("normalizes page values while treating page one as the canonical default", () => {
    expect(normalizePublicPageSearchValue("2")).toBe(2);
    expect(normalizePublicPageSearchValue(3)).toBe(3);
    expect(normalizePublicPageSearchValue("1")).toBeUndefined();
    expect(normalizePublicPageSearchValue(0)).toBeUndefined();
    expect(normalizePublicPageSearchValue("2.5")).toBeUndefined();
    expect(normalizePublicPageSearchValue("invalid")).toBeUndefined();
  });

  it("preserves unrelated search state while normalizing the default public page parameter", () => {
    expect(
      validatePublicPaginatedSearch({
        page: "4",
        utm_source: "newsletter"
      })
    ).toEqual({
      page: 4,
      utm_source: "newsletter"
    });

    expect(validatePublicPaginatedSearch({ page: "1", utm_source: "newsletter" })).toEqual({
      utm_source: "newsletter"
    });
  });

  it("normalizes news filters and removes blank filter values", () => {
    expect(
      validatePublicFilteredPaginatedSearch({
        page: "3",
        tag: "  สมัครเรียน  ",
        category: "  ประชาสัมพันธ์  ",
        campaign: "admissions"
      })
    ).toEqual({
      page: 3,
      tag: "สมัครเรียน",
      category: "ประชาสัมพันธ์",
      campaign: "admissions"
    });

    expect(validatePublicFilteredPaginatedSearch({ tag: "   ", category: "" })).toEqual({});
  });

  it("keeps the two announcements pagination channels independent", () => {
    expect(
      validatePublicAnnouncementsSearch({
        announcementsPage: "2",
        pagesPage: "5",
        tag: "  ระเบียบ  ",
        category: "  ประกาศ  "
      })
    ).toEqual({
      announcementsPage: 2,
      pagesPage: 5,
      tag: "ระเบียบ",
      category: "ประกาศ"
    });
  });

  it("normalizes the public search query together with result pagination", () => {
    expect(
      validatePublicSearchRouteSearch({
        q: "  สมัครเรียน  ",
        page: "2"
      })
    ).toEqual({
      q: "สมัครเรียน",
      page: 2
    });

    expect(validatePublicSearchRouteSearch({ q: "   ", page: "1" })).toEqual({});
  });

  it("keeps Public pagination and filter reads off browser-owned location state", () => {
    const sourceUrls = [
      new URL("../public/hooks/usePublicPagination.ts", import.meta.url),
      new URL("../public/pages/PublicNewsPage.tsx", import.meta.url),
      new URL("../public/pages/PublicAnnouncementsPage.tsx", import.meta.url)
    ];

    for (const sourceUrl of sourceUrls) {
      const source = readFileSync(sourceUrl, "utf8");
      expect(source).not.toContain("window.location.search");
      expect(source).not.toContain("window.history.pushState");
      expect(source).not.toContain("window.history.replaceState");
      expect(source).not.toContain("useSyncExternalStore");
    }
  });
});
