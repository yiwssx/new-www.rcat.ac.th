import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { isPublicRouteLoadFailure } from "../public/routing/publicHttpSemantics";
import {
  getAnnouncementPagesLoaderInput,
  getContentArchiveLoaderInput,
  loadPublicContentDetailData,
  loadPublicContentListData,
  loadPublicHomeData,
  loadPublicSearchResultsData,
  loadPublicShellData,
  PUBLIC_ANNOUNCEMENT_PAGES_PAGE_SIZE,
  PUBLIC_CONTENT_ARCHIVE_PAGE_SIZE,
  PUBLIC_SEARCH_PAGE_SIZE,
  type PublicRouteLoaderContext
} from "../public/routing/publicRouteLoaders";

function createLoaderContext(resolveData?: (queryKey: readonly unknown[]) => unknown) {
  const ensureQueryData = vi.fn(async (options: { queryKey?: readonly unknown[] }) => {
    const queryKey = options.queryKey ?? [];
    return resolveData ? resolveData(queryKey) : queryKey;
  });
  const queryClient = { ensureQueryData } as unknown as QueryClient;

  return {
    context: { queryClient } satisfies PublicRouteLoaderContext,
    ensureQueryData
  };
}

describe("public route loader ownership", () => {
  it("prefetches shell and home through their reusable query contracts", async () => {
    const shellRuntime = createLoaderContext();
    const homeRuntime = createLoaderContext();

    await loadPublicShellData(shellRuntime.context);
    await loadPublicHomeData(homeRuntime.context);

    expect(shellRuntime.ensureQueryData.mock.calls[0]?.[0]?.queryKey).toEqual(["public-shell"]);
    expect(homeRuntime.ensureQueryData.mock.calls[0]?.[0]?.queryKey).toEqual(["public-home-snapshot"]);
  });

  it("uses the same content-list key that the public list hook consumes", async () => {
    const runtime = createLoaderContext();

    await loadPublicContentListData(runtime.context, "news");

    expect(runtime.ensureQueryData.mock.calls[0]?.[0]?.queryKey).toEqual(["public-content-list", "news"]);
  });

  it("prefetches unfiltered content archives by server page while keeping filtered archives on the full-list key", async () => {
    const pagedRuntime = createLoaderContext();
    const filteredRuntime = createLoaderContext();
    const pageInput = getContentArchiveLoaderInput({ page: "3" });
    const filteredPageInput = getContentArchiveLoaderInput({ page: "3", tag: "สมัครเรียน" });

    await loadPublicContentListData(pagedRuntime.context, "news", undefined, pageInput);
    await loadPublicContentListData(filteredRuntime.context, "news", undefined, filteredPageInput);

    expect(pageInput).toEqual({ page: 3, pageSize: PUBLIC_CONTENT_ARCHIVE_PAGE_SIZE });
    expect(filteredPageInput).toBeUndefined();
    expect(pagedRuntime.ensureQueryData.mock.calls[0]?.[0]?.queryKey).toEqual([
      "public-content-list",
      "news",
      "page",
      3,
      PUBLIC_CONTENT_ARCHIVE_PAGE_SIZE
    ]);
    expect(filteredRuntime.ensureQueryData.mock.calls[0]?.[0]?.queryKey).toEqual(["public-content-list", "news"]);
  });

  it("keys announcement public-page prefetch by normalized pagesPage", async () => {
    const runtime = createLoaderContext();
    const pageInput = getAnnouncementPagesLoaderInput({ pagesPage: "3" });

    await loadPublicContentListData(runtime.context, "announcements", pageInput);

    expect(pageInput).toEqual({ page: 3, pageSize: PUBLIC_ANNOUNCEMENT_PAGES_PAGE_SIZE });
    expect(runtime.ensureQueryData.mock.calls[0]?.[0]?.queryKey).toEqual([
      "public-content-list",
      "announcements",
      "pages",
      3,
      PUBLIC_ANNOUNCEMENT_PAGES_PAGE_SIZE
    ]);
  });

  it("does not issue a search data request until q is non-empty", async () => {
    const blankRuntime = createLoaderContext();
    const queryRuntime = createLoaderContext();

    await loadPublicSearchResultsData(blankRuntime.context, { query: "   ", page: 4 });
    await loadPublicSearchResultsData(queryRuntime.context, { query: "เกษตร", page: 2 });

    expect(blankRuntime.ensureQueryData).not.toHaveBeenCalled();
    expect(queryRuntime.ensureQueryData.mock.calls[0]?.[0]?.queryKey).toEqual([
      "public-search-index",
      "page",
      "เกษตร",
      2,
      PUBLIC_SEARCH_PAGE_SIZE
    ]);
  });

  it("uses detail-scoped media for the lightweight head projection even when home media excludes it", async () => {
    const item = {
      id: "content-1",
      title: "ข่าว",
      slug: "sample-slug",
      type: "news",
      status: "published",
      owner: "ประชาสัมพันธ์",
      summary: "สรุป",
      featuredMediaId: "media-1",
      updatedAt: "2026-08-04T00:00:00.000Z",
      publishAt: "2026-08-04T00:00:00.000Z"
    };
    const featuredMedia = {
      id: "media-1",
      name: "ภาพข่าว",
      type: "image",
      size: "1200x630",
      owner: "ประชาสัมพันธ์",
      updatedAt: "2026-08-04T00:00:00.000Z"
    };
    const siteSettings = { siteName: "RCAT" };
    const runtime = createLoaderContext((queryKey) => {
      if (queryKey[0] === "content-detail") {
        return {
          item,
          media: [featuredMedia],
          generatedAt: "2026-08-04T00:00:00.000Z"
        };
      }
      if (queryKey[0] === "cms-snapshot") return { media: [], siteSettings };
      return queryKey;
    });

    const loaderData = await loadPublicContentDetailData(runtime.context, "sample-slug");

    const keys = runtime.ensureQueryData.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toContainEqual(["content-detail", "sample-slug"]);
    expect(keys).toContainEqual(["cms-snapshot"]);
    expect(loaderData).toEqual({ item, siteSettings, featuredMedia });
  });

  it("returns a JSON-safe 503 marker when Public prefetch fails instead of exposing the error object", async () => {
    const ensureQueryData = vi.fn(async () => {
      throw new Error("upstream secret detail");
    });
    const context = {
      queryClient: { ensureQueryData } as unknown as QueryClient
    } satisfies PublicRouteLoaderContext;

    const loaderData = await loadPublicContentListData(context, "news");

    expect(isPublicRouteLoadFailure(loaderData)).toBe(true);
    expect(loaderData).toEqual({
      __rcatPublicRouteFailure: "rcat-public-route-upstream-failure",
      status: 503,
      retryAfterSeconds: 300
    });
    expect(JSON.stringify(loaderData)).not.toContain("upstream secret detail");
  });
});
