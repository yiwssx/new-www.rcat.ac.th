import { createPublicContentDetailSnapshot, createPublicContentListSnapshot } from "../adapters/publicContentAdapter";
import { mapMediaAssetRowToPublicMediaAsset } from "../adapters/publicMediaAdapter";
import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import {
  countPublishedContentSummaryRows,
  getPublishedContentRowBySlug,
  listPublishedContentSummaryPageRows,
  listPublishedContentSummaryRows,
  type PublicContentReadRow,
  type PublicContentSummaryReadRow
} from "../db/contentRepository";
import { readPublicMediaRowsByIds, readPublicShellMetadataRows } from "../db/publicMetadataRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const CONTENT_LIST_RESOURCE = "content-list";
const CONTENT_DETAIL_RESOURCE = "content-detail";
const PHASE = "M17-B";

const CONTENT_KIND_TO_TYPE = {
  news: "news",
  announcements: "announcement",
  blog: "blog"
} as const;

interface PaginationInput {
  page: number;
  pageSize: number;
}

function getOptionalPaginationInput(request: Request): PaginationInput | undefined {
  const url = new URL(request.url);
  const pageValue = url.searchParams.get("page");

  if (pageValue === null) {
    return undefined;
  }

  const page = Number(pageValue);

  if (!Number.isInteger(page) || page <= 0) {
    return undefined;
  }

  const requestedPageSize = Number(url.searchParams.get("pageSize"));
  const pageSize = Number.isInteger(requestedPageSize) ? Math.min(Math.max(requestedPageSize, 1), 100) : 20;

  return { page, pageSize };
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

export async function publicContentList(request: Request, env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: CONTENT_LIST_RESOURCE,
      phase: PHASE
    });
  }

  const kind = new URL(request.url).searchParams.get("kind")?.trim().toLowerCase() || "news";

  if (!(kind in CONTENT_KIND_TO_TYPE)) {
    return jsonError("invalid public content list kind", 400, {
      resource: CONTENT_LIST_RESOURCE
    });
  }

  const publicKind = kind as keyof typeof CONTENT_KIND_TO_TYPE;
  const contentType = CONTENT_KIND_TO_TYPE[publicKind];
  const paginationInput = getOptionalPaginationInput(request);

  try {
    const pageRowsPromise =
      publicKind === "announcements" ? listPublishedContentSummaryRows(env, "page") : Promise.resolve([]);
    const shellMetadataPromise = readPublicShellMetadataRows(env);

    let rows: PublicContentSummaryReadRow[];
    let pagination: ReturnType<typeof createPagination> | undefined;

    if (paginationInput) {
      const totalItems = await countPublishedContentSummaryRows(env, contentType);
      pagination = createPagination(paginationInput, totalItems);
      rows = await listPublishedContentSummaryPageRows(env, contentType, {
        limit: pagination.pageSize,
        offset: (pagination.page - 1) * pagination.pageSize
      });
    } else {
      rows = await listPublishedContentSummaryRows(env, contentType);
    }

    const [pageRows, shellMetadataRows] = await Promise.all([pageRowsPromise, shellMetadataPromise]);
    const mediaRows = await readPublicMediaRowsByIds(env, collectContentMediaIds([...rows, ...pageRows]));
    const metadata = createPublicMetadata({
      ...shellMetadataRows,
      media: mediaRows,
      carouselSlides: [],
      externalServices: [],
      events: []
    });

    return json(createPublicContentListSnapshot(publicKind, rows, pageRows, metadata, new Date(), pagination));
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

    const mediaRows = await readPublicMediaRowsByIds(env, collectContentMediaIds([row]));
    const media = mediaRows.map(mapMediaAssetRowToPublicMediaAsset);
    return json(createPublicContentDetailSnapshot(row, media));
  } catch {
    return jsonError("Unable to load content-detail", 500, {
      resource: CONTENT_DETAIL_RESOURCE,
      phase: PHASE
    });
  }
}
