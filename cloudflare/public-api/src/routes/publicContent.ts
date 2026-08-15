import {
  createPublicContentDetailSnapshot,
  createPublicContentListSnapshot,
  selectRelatedPublicContentCardRows
} from "../adapters/publicContentAdapter";
import { mapMediaAssetRowToPublicMediaAsset } from "../adapters/publicMediaAdapter";
import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import {
  countPublishedContentSummaryRows,
  getPublishedContentRowBySlug,
  listAllPublishedContentCardRows,
  listPublishedContentSummaryPageRows,
  listPublishedContentSummaryRows,
  type PublicContentCardReadRow,
  type PublicContentReadRow,
  type PublicContentSummaryReadRow
} from "../db/contentRepository";
import { readPublicMediaRowsByIds, readPublicShellMetadataRows } from "../db/publicMetadataRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const CONTENT_LIST_RESOURCE = "content-list";
const CONTENT_DETAIL_RESOURCE = "content-detail";
const PHASE = "M17-B";
const ANNOUNCEMENT_PUBLIC_PAGES_PAGE_SIZE = 12;

const CONTENT_KIND_TO_TYPE = {
  news: "news",
  announcements: "announcement",
  blog: "blog"
} as const;

interface PaginationInput {
  page: number;
  pageSize: number;
}

function getOptionalPaginationInput(
  url: URL,
  pageParam = "page",
  pageSizeParam = "pageSize"
): PaginationInput | undefined {
  const pageValue = url.searchParams.get(pageParam);

  if (pageValue === null) {
    return undefined;
  }

  const page = Number(pageValue);

  if (!Number.isInteger(page) || page <= 0) {
    return undefined;
  }

  const requestedPageSize = Number(url.searchParams.get(pageSizeParam));
  const pageSize = Number.isInteger(requestedPageSize) ? Math.min(Math.max(requestedPageSize, 1), 100) : 20;

  return { page, pageSize };
}

function getPaginationInput(
  url: URL,
  pageParam: string,
  pageSizeParam: string,
  defaultPageSize: number
): PaginationInput {
  const requestedPage = Number(url.searchParams.get(pageParam));
  const requestedPageSize = Number(url.searchParams.get(pageSizeParam));

  return {
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pageSize: Number.isInteger(requestedPageSize) ? Math.min(Math.max(requestedPageSize, 1), 100) : defaultPageSize
  };
}

function createPagination(input: PaginationInput, totalItems: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / input.pageSize));
  const page = Math.min(input.page, totalPages);

  return {
    page,
    pageSize: input.pageSize,
    totalItems,
    totalPages
  };
}

function parseMediaIdsJson(value: string | undefined) {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function collectContentMediaIds(rows: Array<PublicContentReadRow | PublicContentSummaryReadRow>) {
  const ids = new Set<string>();

  rows.forEach((row) => {
    if (row.featured_media_id) {
      ids.add(row.featured_media_id);
    }

    parseMediaIdsJson(row.media_ids_json).forEach((id) => {
      if (id) {
        ids.add(id);
      }
    });
  });

  return [...ids];
}

function collectDetailMediaIds(row: PublicContentReadRow, relatedRows: PublicContentCardReadRow[]) {
  const ids = new Set(collectContentMediaIds([row]));
  relatedRows.forEach((relatedRow) => {
    if (relatedRow.featured_media_id) {
      ids.add(relatedRow.featured_media_id);
    }
  });
  return [...ids];
}

export async function publicContentList(request: Request, env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: CONTENT_LIST_RESOURCE,
      phase: PHASE
    });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind")?.trim().toLowerCase() || "news";

  if (!(kind in CONTENT_KIND_TO_TYPE)) {
    return jsonError("invalid public content list kind", 400, {
      resource: CONTENT_LIST_RESOURCE
    });
  }

  const publicKind = kind as keyof typeof CONTENT_KIND_TO_TYPE;
  const contentType = CONTENT_KIND_TO_TYPE[publicKind];
  const paginationInput = getOptionalPaginationInput(url);
  const pageItemsPaginationInput =
    publicKind === "announcements"
      ? getPaginationInput(url, "pagesPage", "pagesPageSize", ANNOUNCEMENT_PUBLIC_PAGES_PAGE_SIZE)
      : undefined;

  try {
    const shellMetadataPromise = readPublicShellMetadataRows(env);
    const [totalItems, totalPageItems] = await Promise.all([
      paginationInput ? countPublishedContentSummaryRows(env, contentType) : Promise.resolve(undefined),
      pageItemsPaginationInput ? countPublishedContentSummaryRows(env, "page") : Promise.resolve(undefined)
    ]);

    const pagination =
      paginationInput && totalItems !== undefined ? createPagination(paginationInput, totalItems) : undefined;
    const pageItemsPagination =
      pageItemsPaginationInput && totalPageItems !== undefined
        ? createPagination(pageItemsPaginationInput, totalPageItems)
        : undefined;

    const rowsPromise = pagination
      ? listPublishedContentSummaryPageRows(env, contentType, {
          limit: pagination.pageSize,
          offset: (pagination.page - 1) * pagination.pageSize
        })
      : listPublishedContentSummaryRows(env, contentType);
    const pageRowsPromise = pageItemsPagination
      ? listPublishedContentSummaryPageRows(env, "page", {
          limit: pageItemsPagination.pageSize,
          offset: (pageItemsPagination.page - 1) * pageItemsPagination.pageSize
        })
      : Promise.resolve([]);

    const [rows, pageRows, shellMetadataRows] = await Promise.all([rowsPromise, pageRowsPromise, shellMetadataPromise]);
    const mediaRows = await readPublicMediaRowsByIds(env, collectContentMediaIds([...rows, ...pageRows]));
    const metadata = createPublicMetadata({
      ...shellMetadataRows,
      media: mediaRows,
      carouselSlides: [],
      externalServices: [],
      events: []
    });

    return json(
      createPublicContentListSnapshot(publicKind, rows, pageRows, metadata, new Date(), pagination, pageItemsPagination)
    );
  } catch {
    return jsonError("Unable to load content-list", 500, {
      resource: CONTENT_LIST_RESOURCE,
      phase: PHASE
    });
  }
}

export async function publicContentDetail(env: Env, slug: string) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: CONTENT_DETAIL_RESOURCE,
      phase: PHASE
    });
  }

  try {
    const row = await getPublishedContentRowBySlug(env, slug);

    if (!row) {
      return jsonError("not found", 404, {
        resource: CONTENT_DETAIL_RESOURCE
      });
    }

    const candidateRows = await listAllPublishedContentCardRows(env);
    const relatedRows = selectRelatedPublicContentCardRows(row, candidateRows);
    const mediaRows = await readPublicMediaRowsByIds(env, collectDetailMediaIds(row, relatedRows));
    const media = mediaRows.map(mapMediaAssetRowToPublicMediaAsset);
    return json(createPublicContentDetailSnapshot(row, media, relatedRows));
  } catch {
    return jsonError("Unable to load content-detail", 500, {
      resource: CONTENT_DETAIL_RESOURCE,
      phase: PHASE
    });
  }
}
