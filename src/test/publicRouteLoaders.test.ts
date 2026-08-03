import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  getAnnouncementPagesLoaderInput,
  loadPublicContentDetailData,
  loadPublicContentListData,
  loadPublicHomeData,
  loadPublicSearchResultsData,
  loadPublicShellData,
  PUBLIC_ANNOUNCEMENT_PAGES_PAGE_SIZE,
  PUBLIC_SEARCH_PAGE_SIZE,
  type PublicRouteLoaderContext
} from "../public/routing/publicRouteLoaders";

function createLoaderContext() {
  const ensureQueryData = vi.fn(async (options: { queryKey?: readonly unknown[] }) => options.queryKey);
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

  it("prefetches both detail and supporting CMS snapshot for content routes", async () => {
    const runtime = createLoaderContext();

    await loadPublicContentDetailData(runtime.context, "sample-slug");

    const keys = runtime.ensureQueryData.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toContainEqual(["content-detail", "sample-slug"]);
    expect(keys).toContainEqual(["cms-snapshot"]);
  });
});
