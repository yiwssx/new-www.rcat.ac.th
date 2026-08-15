import type { QueryClient } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";
import type { ContentItem, MediaAsset, PublicContentListKind } from "../../types";
import {
  createPublicRouteLoadFailure,
  isPublicRouteLoadFailure,
  type PublicRouteLoadFailure
} from "./publicHttpSemantics";
import { normalizePublicPageSearchValue } from "./searchParams";

export interface PublicRouteLoaderContext {
  queryClient: QueryClient;
}

export type PublicContentHeadItem = Pick<
  ContentItem,
  | "id"
  | "title"
  | "slug"
  | "type"
  | "summary"
  | "seoTitle"
  | "seoDescription"
  | "canonicalUrl"
  | "publishAt"
  | "updatedAt"
  | "category"
  | "tags"
>;

export interface PublicContentDetailLoaderData {
  item: PublicContentHeadItem;
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

async function prefetchPublicQuery<T>(prefetch: () => Promise<T>): Promise<PublicRouteLoadFailure | undefined> {
  const result = await ensurePublicQuery(prefetch);
  return isPublicRouteLoadFailure(result) ? result : undefined;
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
  const result = await ensurePublicQuery(() => context.queryClient.ensureQueryData(publicShellQueryOptions()));

  if (isPublicRouteLoadFailure(result)) {
    return result;
  }

  return {
    siteSettings: result.siteSettings
  };
}

export async function loadPublicHomeData(context: PublicRouteLoaderContext) {
  const { publicHomeQueryOptions } = await import("../../features/public-home");
  return prefetchPublicQuery(() => context.queryClient.ensureQueryData(publicHomeQueryOptions()));
}

export async function loadPublicCmsSnapshotData() {
  // Retained temporarily for route compatibility. Public pages should use the
  // parent shell query or their route-specific public query instead of a CMS-wide snapshot.
  return undefined;
}

export async function loadPublicContentListData(
  context: PublicRouteLoaderContext,
  kind: PublicContentListKind,
  pageItemsInput?: PublicContentPageInput,
  pageInput?: PublicContentPageInput | PublicContentArchiveLoaderDeps
) {
  const { publicContentListQueryOptions } = await import("../../features/public-content");
  const resolvedPageInput = resolveContentArchivePageInput(pageInput);
  return prefetchPublicQuery(() =>
    context.queryClient.ensureQueryData(publicContentListQueryOptions(kind, {}, pageItemsInput, resolvedPageInput))
  );
}

export async function loadPublicProgramListData(context: PublicRouteLoaderContext) {
  const { publicProgramListQueryOptions } = await import("../../features/public-programs");
  return prefetchPublicQuery(() => context.queryClient.ensureQueryData(publicProgramListQueryOptions()));
}

export async function loadPublicDocumentListData(context: PublicRouteLoaderContext) {
  const { publicDocumentListQueryOptions } = await import("../../features/public-documents");
  return prefetchPublicQuery(() => context.queryClient.ensureQueryData(publicDocumentListQueryOptions()));
}

export async function loadPublicEventListData(context: PublicRouteLoaderContext) {
  const { publicEventListQueryOptions } = await import("../../features/public-events");
  return prefetchPublicQuery(() => context.queryClient.ensureQueryData(publicEventListQueryOptions()));
}

export async function loadPublicSearchIndexData(context: PublicRouteLoaderContext) {
  const { publicSearchIndexQueryOptions } = await import("../../features/public-search");
  return prefetchPublicQuery(() => context.queryClient.ensureQueryData(publicSearchIndexQueryOptions()));
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
  return prefetchPublicQuery(() =>
    context.queryClient.ensureQueryData(
      publicSearchPageQueryOptions(query, {
        page,
        pageSize: PUBLIC_SEARCH_PAGE_SIZE
      })
    )
  );
}

function createContentHeadItem(item: ContentItem): PublicContentHeadItem {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    type: item.type,
    summary: item.summary,
    seoTitle: item.seoTitle,
    seoDescription: item.seoDescription,
    canonicalUrl: item.canonicalUrl,
    publishAt: item.publishAt,
    updatedAt: item.updatedAt,
    category: item.category,
    tags: item.tags
  };
}

export async function loadPublicContentDetailData(
  context: PublicRouteLoaderContext,
  slug: string | undefined
): Promise<PublicContentDetailLoaderData | PublicRouteLoadFailure | undefined> {
  if (!slug) {
    return undefined;
  }

  const { publicContentDetailQueryOptions } = await import("../../features/public-content");
  const detailResult = await ensurePublicQuery(() =>
    context.queryClient.ensureQueryData(publicContentDetailQueryOptions(slug))
  );

  if (isPublicRouteLoadFailure(detailResult)) {
    return detailResult;
  }

  if (detailResult === null || detailResult === undefined) {
    throw notFound({ data: { resource: "content", slug } });
  }

  const item = detailResult.item;
  const featuredMediaId = item.featuredMediaId;
  const featuredMedia = featuredMediaId
    ? detailResult.media.find((asset) => asset.id === featuredMediaId && asset.type === "image")
    : undefined;

  return {
    item: createContentHeadItem(item),
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
