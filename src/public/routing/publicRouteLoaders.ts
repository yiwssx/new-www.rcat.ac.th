import type { QueryClient } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";
import type { ContentItem, MediaAsset, PublicContentListKind, SiteSettings } from "../../types";
import {
  createPublicRouteLoadFailure,
  isPublicRouteLoadFailure,
  type PublicRouteLoadFailure
} from "./publicHttpSemantics";
import { normalizePublicPageSearchValue } from "./searchParams";

export interface PublicRouteLoaderContext {
  queryClient: QueryClient;
}

export interface PublicContentDetailLoaderData {
  item: ContentItem;
  siteSettings: SiteSettings | undefined;
  featuredMedia: MediaAsset | undefined;
}

interface PublicContentPageInput {
  page: number;
  pageSize?: number;
}

interface PublicContentArchiveLoaderDeps {
  pageInput: PublicContentPageInput | undefined;
}

export const PUBLIC_SEARCH_PAGE_SIZE = 12;
export const PUBLIC_CONTENT_ARCHIVE_PAGE_SIZE = 12;
export const PUBLIC_ANNOUNCEMENT_PAGES_PAGE_SIZE = 12;

async function ensurePublicQuery<T>(prefetch: () => Promise<T>): Promise<T | PublicRouteLoadFailure> {
  try {
    return await prefetch();
  } catch {
    return createPublicRouteLoadFailure();
  }
}

function hasArchiveFilters(search: Record<string, unknown>) {
  return Boolean(String(search.tag || "").trim() || String(search.category || "").trim());
}

export function getContentArchiveLoaderInput(search: Record<string, unknown>): PublicContentArchiveLoaderDeps {
  return {
    pageInput: hasArchiveFilters(search)
      ? undefined
      : {
          page: normalizePublicPageSearchValue(search.page) ?? 1,
          pageSize: PUBLIC_CONTENT_ARCHIVE_PAGE_SIZE
        }
  };
}

function resolveContentArchivePageInput(
  input: PublicContentPageInput | PublicContentArchiveLoaderDeps | undefined
): PublicContentPageInput | undefined {
  if (input && "pageInput" in input) {
    return input.pageInput;
  }

  return input;
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
  pageItemsInput?: PublicContentPageInput,
  pageInput?: PublicContentPageInput | PublicContentArchiveLoaderDeps
) {
  const { publicContentListQueryOptions } = await import("../../features/public-content");
  const resolvedPageInput = resolveContentArchivePageInput(pageInput);
  return ensurePublicQuery(() =>
    context.queryClient.ensureQueryData(publicContentListQueryOptions(kind, {}, pageItemsInput, resolvedPageInput))
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
): Promise<PublicContentDetailLoaderData | PublicRouteLoadFailure | undefined> {
  if (!slug) {
    return undefined;
  }

  const { publicContentDetailQueryOptions } = await import("../../features/public-content");
  const [detailResult, cmsSnapshotResult] = await Promise.all([
    ensurePublicQuery(() => context.queryClient.ensureQueryData(publicContentDetailQueryOptions(slug))),
    loadPublicCmsSnapshotData(context)
  ]);

  if (isPublicRouteLoadFailure(detailResult)) {
    return detailResult;
  }

  if (detailResult === null || detailResult === undefined) {
    throw notFound({ data: { resource: "content", slug } });
  }

  if (isPublicRouteLoadFailure(cmsSnapshotResult)) {
    return cmsSnapshotResult;
  }

  const item = detailResult.item;
  const featuredMediaId = item.featuredMediaId;
  const detailFeaturedMedia = featuredMediaId
    ? detailResult.media.find((asset) => asset.id === featuredMediaId && asset.type === "image")
    : undefined;
  const snapshotFeaturedMedia = featuredMediaId
    ? cmsSnapshotResult?.media.find((asset) => asset.id === featuredMediaId && asset.type === "image")
    : undefined;
  const featuredMedia = detailFeaturedMedia ?? snapshotFeaturedMedia;

  return {
    item,
    siteSettings: cmsSnapshotResult?.siteSettings,
    featuredMedia
  };
}

export async function loadPublicContentPermalinkData(context: PublicRouteLoaderContext, slug: string | undefined) {
  const loaderData = await loadPublicContentDetailData(context, slug);

  if (!slug || !loaderData || isPublicRouteLoadFailure(loaderData)) {
    return loaderData;
  }

  throw redirect({
    to: "/content/$slug",
    params: { slug },
    statusCode: 301
  });
}

export function getAnnouncementPagesLoaderInput(search: Record<string, unknown>) {
  return {
    page: normalizePublicPageSearchValue(search.pagesPage) ?? 1,
    pageSize: PUBLIC_ANNOUNCEMENT_PAGES_PAGE_SIZE
  };
}
