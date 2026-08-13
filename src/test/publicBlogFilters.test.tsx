import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicBlogPage from "../public/pages/PublicBlogPage";
import PublicContentDetailPage from "../public/pages/PublicContentDetailPage";
import type { CmsSnapshot, ContentItem, PublicContentListSnapshot } from "../types";

const testState = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  contentList: undefined as PublicContentListSnapshot | undefined,
  snapshot: undefined as CmsSnapshot | undefined,
  detail: undefined as ContentItem | undefined
}));

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  pagination: vi.fn(),
  recordContentView: vi.fn()
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => mocks.navigate,
  useRouterState: (options?: { select?: (state: { location: { search: Record<string, unknown> } }) => unknown }) => {
    const state = { location: { search: testState.search } };
    return options?.select ? options.select(state) : state;
  }
}));

vi.mock("../public/components/PublicSiteShell", () => ({
  default: ({ children }: { children?: ReactNode }) => <div data-testid="public-site-shell">{children}</div>
}));

vi.mock("../public/components/PublicContentCard", () => ({
  default: ({ item }: { item: ContentItem }) => <div data-testid={`content-card-${item.id}`}>{item.title}</div>
}));

vi.mock("../public/hooks/usePublicContentList", () => ({
  usePublicContentList: () => ({
    data: testState.contentList,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn()
  })
}));

vi.mock("../public/hooks/usePublicPagination", () => ({
  usePublicPagination: (items: ContentItem[], options: { pageSize: number; resetKeys?: readonly unknown[] }) => {
    mocks.pagination(items, options);
    return {
      page: 1,
      pageCount: 1,
      pageSize: options.pageSize,
      paginatedItems: items,
      setPage: vi.fn(),
      totalItems: items.length
    };
  }
}));

vi.mock("../public/hooks/usePublicCmsSnapshot", () => ({
  usePublicCmsSnapshot: () => ({
    data: testState.snapshot,
    isLoading: false,
    isFetching: false
  })
}));

vi.mock("../public/hooks/usePublicContentDetail", () => ({
  usePublicContentDetail: () => ({
    data: testState.detail,
    isLoading: false,
    isFetching: false
  })
}));

vi.mock("../features/site-view", () => ({
  recordContentView: mocks.recordContentView
}));

function createBlogItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "blog-1",
    title: "บทความนวัตกรรมเกษตร",
    slug: "agri-innovation",
    type: "blog",
    status: "published",
    owner: "งานประชาสัมพันธ์",
    summary: "บทความทดสอบ",
    body: "",
    category: "เกษตร, เทคโนโลยี",
    tags: ["นวัตกรรม", "เกษตร"],
    updatedAt: "2026-08-13T00:00:00.000Z",
    publishAt: "2026-08-13T00:00:00.000Z",
    viewCount: 1,
    ...overrides
  };
}

function createBlogList(items: ContentItem[]): PublicContentListSnapshot {
  return {
    kind: "blog",
    items,
    pageItems: [],
    media: [],
    menu: [],
    generatedAt: "2026-08-13T00:00:00.000Z"
  } as unknown as PublicContentListSnapshot;
}

beforeEach(() => {
  window.localStorage.clear();
  mocks.navigate.mockReset();
  mocks.pagination.mockReset();
  mocks.recordContentView.mockReset();
  mocks.recordContentView.mockResolvedValue({
    id: "blog-1",
    slug: "agri-innovation",
    viewCount: 2,
    lastViewedAt: "2026-08-13T01:00:00.000Z"
  });
  testState.search = {};
  testState.contentList = createBlogList([]);
  testState.snapshot = undefined;
  testState.detail = undefined;
});

afterEach(() => {
  cleanup();
});

describe("public blog filters", () => {
  it("filters the blog archive by tag and keeps the filter visible", () => {
    testState.search = { tag: "นวัตกรรม" };
    testState.contentList = createBlogList([
      createBlogItem(),
      createBlogItem({
        id: "blog-2",
        title: "บทความกิจกรรมนักเรียน",
        slug: "student-activity",
        tags: ["กิจกรรม"],
        category: "กิจกรรม"
      }),
      createBlogItem({
        id: "blog-3",
        title: "บทความนวัตกรรมดิจิทัล",
        slug: "digital-innovation",
        tags: ["นวัตกรรม"],
        category: "ดิจิทัล"
      })
    ]);

    render(<PublicBlogPage />);

    expect(screen.getByText("บทความนวัตกรรมเกษตร")).toBeInTheDocument();
    expect(screen.getByText("บทความนวัตกรรมดิจิทัล")).toBeInTheDocument();
    expect(screen.queryByText("บทความกิจกรรมนักเรียน")).not.toBeInTheDocument();
    expect(screen.getByText("#นวัตกรรม")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ล้างตัวกรอง" })).toHaveAttribute("href", "/blog");
    expect(mocks.pagination).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.objectContaining({ resetKeys: ["นวัตกรรม", ""] })
    );
  });

  it("filters the blog archive by a comma-separated category", () => {
    testState.search = { category: "เทคโนโลยี" };
    testState.contentList = createBlogList([
      createBlogItem(),
      createBlogItem({
        id: "blog-2",
        title: "บทความกีฬา",
        slug: "sports",
        tags: ["กีฬา"],
        category: "กิจกรรม, กีฬา"
      })
    ]);

    render(<PublicBlogPage />);

    expect(screen.getByText("บทความนวัตกรรมเกษตร")).toBeInTheDocument();
    expect(screen.queryByText("บทความกีฬา")).not.toBeInTheDocument();
    expect(screen.getByText("เทคโนโลยี")).toBeInTheDocument();
  });

  it("links blog detail tags back to the blog archive instead of news", () => {
    const item = createBlogItem();
    testState.detail = item;
    testState.snapshot = {
      metrics: [],
      content: [item],
      media: [],
      events: [],
      menu: []
    } as CmsSnapshot;
    window.localStorage.setItem(`rcat.cms.viewed.${item.id}`, String(Date.now()));

    render(<PublicContentDetailPage slug={item.slug} />);

    expect(screen.getByText("#นวัตกรรม").closest("a")).toHaveAttribute(
      "href",
      "/blog?tag=%E0%B8%99%E0%B8%A7%E0%B8%B1%E0%B8%95%E0%B8%81%E0%B8%A3%E0%B8%A3%E0%B8%A1"
    );
  });
});
