import { describe, expect, it } from "vitest";
import { ContentItem } from "../types";
import { searchPublishedContent } from "../utils/search";

function createContentItem(overrides: Partial<ContentItem>): ContentItem {
  return {
    id: "content-1",
    title: "General campus update",
    slug: "general-campus-update",
    type: "news",
    status: "published",
    owner: "Admin",
    summary: "",
    updatedAt: "2026-05-10T00:00:00.000Z",
    publishAt: "2026-05-10T00:00:00.000Z",
    ...overrides
  };
}

describe("searchPublishedContent", () => {
  it("returns an empty list for an empty query", () => {
    expect(searchPublishedContent([createContentItem({ title: "ข่าวรับสมัครงาน" })], "")).toEqual([]);
  });

  it("matches published content across title, summary, category, and tags", () => {
    const items = [
      createContentItem({
        id: "title-match",
        title: "ข่าวสมัครงานครู",
        slug: "teacher-job"
      }),
      createContentItem({
        id: "summary-match",
        title: "ประกาศทั่วไป",
        slug: "general",
        summary: "รายละเอียดจัดซื้อครุภัณฑ์"
      }),
      createContentItem({
        id: "category-match",
        title: "เอกสารเผยแพร่",
        slug: "procurement-doc",
        category: "จัดซื้อจัดจ้าง"
      }),
      createContentItem({
        id: "tag-match",
        title: "ข่าววิทยาลัย",
        slug: "award",
        tags: ["achievement", "award"]
      })
    ];

    expect(searchPublishedContent(items, "สมัครงาน")).toEqual([items[0]]);
    expect(searchPublishedContent(items, "ครุภัณฑ์")).toEqual([items[1]]);
    expect(searchPublishedContent(items, "จัดจ้าง")).toEqual([items[2]]);
    expect(searchPublishedContent(items, "award")).toEqual([items[3]]);
  });

  it("excludes unpublished content", () => {
    const draft = createContentItem({
      title: "Draft admissions update",
      status: "draft"
    });

    expect(searchPublishedContent([draft], "admissions")).toEqual([]);
  });

  it("requires every search term and sorts stronger title matches first", () => {
    const titleMatch = createContentItem({
      id: "title-match",
      title: "Admissions scholarship update",
      slug: "admissions-scholarship",
      summary: "Campus news",
      publishAt: "2026-05-01T00:00:00.000Z"
    });
    const summaryMatch = createContentItem({
      id: "summary-match",
      title: "Campus update",
      slug: "campus-update",
      summary: "Admissions scholarship timeline",
      publishAt: "2026-05-10T00:00:00.000Z"
    });
    const partialMatch = createContentItem({
      id: "partial-match",
      title: "Admissions only",
      slug: "admissions-only",
      summary: "No second term here"
    });

    expect(searchPublishedContent([summaryMatch, partialMatch, titleMatch], "admissions scholarship")).toEqual([
      titleMatch,
      summaryMatch
    ]);
  });
});
