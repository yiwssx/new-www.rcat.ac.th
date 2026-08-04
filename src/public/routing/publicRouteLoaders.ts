import type { QueryClient } from "@tanstack/react-query";
import type { ContentItem, MediaAsset, PublicContentListKind, SiteSettings } from "../../types";
import { normalizePublicPageSearchValue } from "./searchParams";

export interface PublicRouteLoaderContext {
  queryClient: QueryClient;
}

export interface PublicContentDetailLoaderData {
  item: ContentItem | null | undefined;
  siteSettings: SiteSettings | undefined;
  featuredMedia: MediaAsset | undefined;
}

export const PUBLIC_SEARCH_PAGE_SIZE = 12;
export const PUBLIC_ANNOUNCEMENT_PAGES_PAGE_SIZE = 12;

async function ensurePublicQuery<T>(prefetch: () => Promise<T>) {
  try {
    return await prefetch();
  } catch {
    // Phase 2 owns prefetch timing but intentionally preserves the existing
    // page-level PublicErrorState contract. Phase 6 will map typed read errors
    // to production HTTP status/redirect semantics.
    return undefined;
  }
}

export async function loadPublicShellData(context: PublicRouteLoaderContext) {
  const { publicShellQueryOptions } = await import("../../features/public-shell");
  return ensurePublicQuery(() => context.queryClient.ensureQueryData(publicShellQueryOptions()));
}

export async function loadPublicHomeData(context: PublicRouteLoaderContext) {
  const { publicHomeQueryOptions } = await import("../../features/public-home");
  return ensurePublicQuery(() => context.queryClient.ensureQueryData(publicHomeQueryOptions()));
}

export async function loadPublicCmsSnapshotData(context: PublicRouteLoaderContext) {
  const { publicCmsSnapshotQueryOptions } = await import("../../features/public-read/cmsSnapshot");
  return ensurePublicQuery(() => context.queryClient.ensureQueryData(publicCmsSnapshotQueryOptions()));
}

export async function loadPublicContentListData(
  context: PublicRouteLoaderContext,
  kind: PublicContentListKind,
  pageItemsInput?: { page: number; pageSize?: number }
) {
  const { publicContentListQueryOptions } = await import("../../features/public-content");
  return ensurePublicQuery(() =>
    context.queryClient.ensureQueryData(publicContentListQueryOptions(kind, {}, pageItemsInput))
  );
}

export async function loadPublicProgramListData(context: PublicRouteLoaderContext) {
  const { publicProgramListQueryOptions } = await import("../../features/public-programs");
  return ensurePublicQuery(() => context.queryClient.ensureQueryData(publicProgramListQueryOptions()));
}

export async function loadPublicDocumentListData(context: PublicRouteLoaderContext) {
  const { publicDocumentListQueryOptions } = await import("../../features/public-documents");
  return ensurePublicQuery(() => context.queryClient.ensureQueryData(publicDocumentListQueryOptions()));
}

export async function loadPublicEventListData(context: PublicRouteLoaderContext) {
  const { publicEventListQueryOptions } = await import("../../features/public-events");
  return ensurePublicQuery(() => context.queryClient.ensureQueryData(publicEventListQueryOptions()));
}

export async function loadPublicSearchIndexData(context: PublicRouteLoaderContext) {
  const { publicSearchIndexQueryOptions } = await import("../../features/public-search");
  return ensurePublicQuery(() => context.queryClient.ensureQueryData(publicSearchIndexQueryOptions()));
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
  return ensurePublicQuery(() =>
    context.queryClient.ensureQueryData(
      publicSearchPageQueryOptions(query, {
        page,
        pageSize: PUBLIC_SEARCH_PAGE_SIZE
      })
    )
  );
}

export async function loadPublicContentDetailData(
  context: PublicRouteLoaderContext,
  slug: string | undefined
): Promise<PublicContentDetailLoaderData | undefined> {
  if (!slug) {
    return undefined;
  }

  const { publicContentDetailQueryOptions } = await import("../../features/public-content");
  const [item, cmsSnapshot] = await Promise.all([
    ensurePublicQuery(() => context.queryClient.ensureQueryData(publicContentDetailQueryOptions(slug))),
    loadPublicCmsSnapshotData(context)
  ]);
  const featuredMedia = item?.featuredMediaId
    ? cmsSnapshot?.media.find((asset) => asset.id === item.featuredMediaId && asset.type === "image")
    : undefined;

  return {
    item,
    siteSettings: cmsSnapshot?.siteSettings,
    featuredMedia
  };
}

export function getAnnouncementPagesLoaderInput(search: Record<string, unknown>) {
  return {
    page: normalizePublicPageSearchValue(search.pagesPage) ?? 1,
    pageSize: PUBLIC_ANNOUNCEMENT_PAGES_PAGE_SIZE
  };
}
