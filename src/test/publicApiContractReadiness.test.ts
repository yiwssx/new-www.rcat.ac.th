import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPublicAnnouncementsContentListSnapshot,
  getPublicContentDetailSnapshot,
  getPublicContentListPageSnapshot
} from "../features/public-content";
import { getPublicSearchIndexSnapshot, getPublicSearchPageSnapshot } from "../features/public-search";
import { getPublicShellSnapshot } from "../features/public-shell";

const generatedAt = "2026-08-03T00:00:00.000Z";
const summaryItem = {
  id: "news-1",
  title: "Award news",
  slug: "award-news",
  type: "news",
  status: "published",
  owner: "",
  summary: "award",
  updatedAt: generatedAt,
  publishAt: generatedAt
};
const sharedMetadata = {
  siteSettings: {},
  homepageSettings: {},
  displaySettings: {},
  menu: [],
  generatedAt
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("Step 4 public API contract readiness", () => {
  it("delegates a normalized public search query to the Worker", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    const fetchMock = vi.fn(async () => jsonResponse({ ...sharedMetadata, query: "award", items: [summaryItem] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicSearchIndexSnapshot("  award  ")).resolves.toMatchObject({
      query: "award",
      items: [expect.objectContaining({ id: "news-1" })]
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://public-api.example.test/api/public/search?q=award",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("builds a paginated public search request and validates pagination metadata", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ...sharedMetadata,
        query: "award",
        items: [summaryItem],
        pagination: { page: 2, pageSize: 12, totalItems: 13, totalPages: 2 }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicSearchPageSnapshot(" award ", { page: 2, pageSize: 12 })).resolves.toMatchObject({
      query: "award",
      pagination: { page: 2, pageSize: 12, totalItems: 13, totalPages: 2 }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://public-api.example.test/api/public/search?q=award&page=2&pageSize=12",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("builds the opt-in paginated content request without changing the default API", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ...sharedMetadata,
        kind: "news",
        items: [summaryItem],
        media: [],
        pagination: { page: 2, pageSize: 12, totalItems: 13, totalPages: 2 }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicContentListPageSnapshot("news", { page: 2, pageSize: 12 })).resolves.toMatchObject({
      pagination: { page: 2, pageSize: 12, totalItems: 13, totalPages: 2 }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://public-api.example.test/api/public/content?kind=news&page=2&pageSize=12",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("requests only the selected announcement public-page slice and validates its pagination", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    const pageItem = { ...summaryItem, id: "page-13", slug: "public-page-13", type: "page" };
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ...sharedMetadata,
        kind: "announcements",
        items: [summaryItem],
        pageItems: [pageItem],
        pageItemsPagination: { page: 2, pageSize: 12, totalItems: 13, totalPages: 2 },
        media: []
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicAnnouncementsContentListSnapshot({ page: 2, pageSize: 12 })).resolves.toMatchObject({
      pageItems: [expect.objectContaining({ id: "page-13" })],
      pageItemsPagination: { page: 2, pageSize: 12, totalItems: 13, totalPages: 2 }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://public-api.example.test/api/public/content?kind=announcements&pagesPage=2&pagesPageSize=12",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("exposes detail media while keeping the full article body on detail only", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          item: { ...summaryItem, body: "Full body" },
          media: [{ id: "media-1" }],
          generatedAt
        })
      )
    );

    await expect(getPublicContentDetailSnapshot({ slug: "award-news" })).resolves.toMatchObject({
      item: { body: "Full body" },
      media: [{ id: "media-1" }]
    });
  });

  it("falls back to the home metadata contract when an older Worker does not expose public-shell", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "not found" }, 404))
      .mockResolvedValueOnce(
        jsonResponse({
          ...sharedMetadata,
          carouselSlides: [],
          externalServices: [],
          visitorStats: {},
          latestNews: [],
          latestAnnouncements: [],
          procurementItems: [],
          jobOpportunityItems: [],
          achievementItems: [],
          programItems: [],
          documentItems: [],
          eventItems: [],
          media: []
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicShellSnapshot()).resolves.toEqual(sharedMetadata);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://public-api.example.test/api/public/shell",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://public-api.example.test/api/public/home",
      expect.objectContaining({ method: "GET" })
    );
  });
});
