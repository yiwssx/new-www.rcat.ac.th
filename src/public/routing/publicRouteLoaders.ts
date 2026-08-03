import type { QueryClient } from "@tanstack/react-query";
import type { PublicContentListKind } from "../../types";
import { normalizePublicPageSearchValue } from "./searchParams";

export interface PublicRouteLoaderContext {
  queryClient: QueryClient;
}

export const PUBLIC_SEARCH_PAGE_SIZE = 12;
export const PUBLIC_ANNOUNCEMENT_PAGES_PAGE_SIZE = 12;

type EnsureQueryOptions = Parameters<QueryClient["ensureQueryData"]>[0];

async function ensurePublicQuery(queryClient: QueryClient, options: EnsureQueryOptions) {
  try {
    return await queryClient.ensureQueryData(options);
  } catch {
    // Phase 2 owns prefetch timing but intentionally preserves the existing
    // page-level PublicErrorState contract. Phase 6 will map typed read errors
    // to production HTTP status/redirect semantics.
    return undefined;
  }
}

export async function loadPublicShellData(context: PublicRouteLoaderContext) {
  const { publicShellQueryOptions } = await import("../../features/public-shell");
  return ensurePublicQuery(context.queryClient, publicShellQueryOptions());
}

export async function loadPublicHomeData(context: PublicRouteLoaderContext) {
  const { publicHomeQueryOptions } = await import("../../features/public-home");
  return ensurePublicQuery(context.queryClient, publicHomeQueryOptions());
}

export async function loadPublicContentListData(
  context: PublicRouteLoaderContext,
  kind: PublicContentListKind,
  pageItemsInput?: { page: number; pageSize?: number }
) {
  const { publicContentListQueryOptions } = await import("../../features/public-content");
  return ensurePublicQuery(context.queryClient, publicContentListQueryOptions(kind, {}, pageItemsInput));
}

export async function loadPublicProgramListData(context: PublicRouteLoaderContext) {
  const { publicProgramListQueryOptions } = await import("../../features/public-programs");
  return ensurePublicQuery(context.queryClient, publicProgramListQueryOptions());
}

export async function loadPublicDocumentListData(context: PublicRouteLoaderContext) {
  const { publicDocumentListQueryOptions } = await import("../../features/public-documents");
  return ensurePublicQuery(context.queryClient, publicDocumentListQueryOptions());
}

export async function loadPublicEventListData(context: PublicRouteLoaderContext) {
  const { publicEventListQueryOptions } = await import("../../features/public-events");
  return ensurePublicQuery(context.queryClient, publicEventListQueryOptions());
}

export async function loadPublicSearchIndexData(context: PublicRouteLoaderContext) {
  const { publicSearchIndexQueryOptions } = await import("../../features/public-search");
  return ensurePublicQuery(context.queryClient, publicSearchIndexQueryOptions());
}

export async function loadPublicSearchResultsData(
  context: PublicRouteLoaderContext,
  input: { query?: string; page?: unknown }
) {
  const query = String(input.query || "").trim();
  if (!query) {
    return undefined;
  }

  const page = normalizePublicPageSearchValue(input.page) ?? 1;
  const { publicSearchPageQueryOptions } = await import("../../features/public-search");
  return ensurePublicQuery(
    context.queryClient,
    publicSearchPageQueryOptions(query, {
      page,
      pageSize: PUBLIC_SEARCH_PAGE_SIZE
    })
  );
}

export async function loadPublicContentDetailData(context: PublicRouteLoaderContext, slug: string | undefined) {
  if (!slug) {
    return undefined;
  }

  const [{ publicContentDetailQueryOptions }, { publicCmsSnapshotQueryOptions }] = await Promise.all([
    import("../../features/public-content"),
    import("../../features/public-read/cmsSnapshot")
  ]);

  const [detail] = await Promise.all([
    ensurePublicQuery(context.queryClient, publicContentDetailQueryOptions(slug)),
    ensurePublicQuery(context.queryClient, publicCmsSnapshotQueryOptions())
  ]);

  return detail;
}

export function getAnnouncementPagesLoaderInput(search: Record<string, unknown>) {
  return {
    page: normalizePublicPageSearchValue(search.pagesPage) ?? 1,
    pageSize: PUBLIC_ANNOUNCEMENT_PAGES_PAGE_SIZE
  };
}
