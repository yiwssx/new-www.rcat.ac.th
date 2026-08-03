import { createPublicContentDetailSnapshot, createPublicContentListSnapshot } from "../adapters/publicContentAdapter";
import { mapMediaAssetRowToPublicMediaAsset } from "../adapters/publicMediaAdapter";
import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import { getPublishedContentRowBySlug, listPublishedContentSummaryRows } from "../db/contentRepository";
import { readPublicMediaRows, readPublicMetadataRows } from "../db/publicMetadataRepository";
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

function getOptionalPagination(request: Request, totalItems: number) {
  const url = new URL(request.url);
  const pageValue = url.searchParams.get("page");

  if (pageValue === null) {
    return undefined;
  }

  const requestedPage = Number(pageValue);

  if (!Number.isInteger(requestedPage) || requestedPage <= 0) {
    return undefined;
  }

  const requestedPageSize = Number(url.searchParams.get("pageSize"));
  const pageSize = Number.isInteger(requestedPageSize) ? Math.min(Math.max(requestedPageSize, 1), 100) : 20;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(requestedPage, totalPages);

  return {
    page,
    pageSize,
    totalItems,
    totalPages
  };
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

  try {
    const [rows, pageRows, metadataRows] = await Promise.all([
      listPublishedContentSummaryRows(env, CONTENT_KIND_TO_TYPE[publicKind]),
      publicKind === "announcements" ? listPublishedContentSummaryRows(env, "page") : Promise.resolve([]),
      readPublicMetadataRows(env)
    ]);
    const pagination = getOptionalPagination(request, rows.length);
    const selectedRows = pagination
      ? rows.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize)
      : rows;

    return json(
      createPublicContentListSnapshot(
        publicKind,
        selectedRows,
        pageRows,
        createPublicMetadata(metadataRows),
        new Date(),
        pagination
      )
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

    const mediaRows = await readPublicMediaRows(env);
    const media = mediaRows.map(mapMediaAssetRowToPublicMediaAsset);
    return json(createPublicContentDetailSnapshot(row, media));
  } catch {
    return jsonError("Unable to load content-detail", 500, {
      resource: CONTENT_DETAIL_RESOURCE,
      phase: PHASE
    });
  }
}
