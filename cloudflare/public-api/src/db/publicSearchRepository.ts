import type { Env } from "../env";
import {
  PUBLIC_CONTENT_SUMMARY_READ_COLUMNS,
  type PublicContentSummaryReadRow
} from "./contentRepository";
import { logD1QueryUsage } from "./d1QueryUsage";
import { requireD1Database } from "./documentsRepository";
import { PUBLIC_PUBLISHED_CONTENT_FILTER_SQL, publicPublishedContentBindings } from "./publicContentVisibility";

interface SearchPageRow extends PublicContentSummaryReadRow {
  total_items?: number | string;
}

export interface PublicSearchPageResult {
  rows: PublicContentSummaryReadRow[];
  page: number;
  pageSize: number;
  totalItems: number;
}

function createSearchFilter(query: string) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return {
      sql: "",
      bindings: [] as string[]
    };
  }

  const pattern = `%${normalizedQuery}%`;
  return {
    sql: `
         AND (
           title LIKE ?
           OR summary LIKE ?
           OR body_snapshot LIKE ?
           OR category LIKE ?
           OR tags_json LIKE ?
         )`,
    bindings: [pattern, pattern, pattern, pattern, pattern]
  };
}

function stripWindowCount(rows: SearchPageRow[]) {
  return rows.map(({ total_items: _totalItems, ...row }) => row as PublicContentSummaryReadRow);
}

async function readSearchPage(
  env: Env,
  query: string,
  pageSize: number,
  offset: number,
  queryName: string
): Promise<{ rows: PublicContentSummaryReadRow[]; totalItems: number }> {
  const searchFilter = createSearchFilter(query);
  const result = await requireD1Database(env)
    .prepare(
      `SELECT ${PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ")}, COUNT(*) OVER() AS total_items
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND COALESCE(deleted_at, '') = ''${searchFilter.sql}
       ORDER BY publish_at DESC, updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...publicPublishedContentBindings(...searchFilter.bindings, pageSize, offset))
    .all<SearchPageRow>();

  logD1QueryUsage(env, queryName, result);
  const sourceRows = result.results ?? [];
  const projectedTotal = Number(sourceRows[0]?.total_items);

  return {
    rows: stripWindowCount(sourceRows.length > pageSize ? sourceRows.slice(offset, offset + pageSize) : sourceRows),
    // Lightweight repository test doubles may not evaluate COUNT(*) OVER().
    totalItems: Number.isFinite(projectedTotal) ? Math.max(0, projectedTotal) : sourceRows.length
  };
}

async function countSearchRows(env: Env, query: string) {
  const searchFilter = createSearchFilter(query);
  const result = await requireD1Database(env)
    .prepare(
      `SELECT COUNT(*) AS total_items
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND COALESCE(deleted_at, '') = ''${searchFilter.sql}`
    )
    .bind(...publicPublishedContentBindings(...searchFilter.bindings))
    .all<{ total_items: number | string }>();

  logD1QueryUsage(env, "search:count-fallback", result);
  const projectedTotal = Number(result.results?.[0]?.total_items);
  return Number.isFinite(projectedTotal) ? Math.max(0, projectedTotal) : result.results?.length ?? 0;
}

export async function searchPublishedContentPageWithCountRows(
  env: Env,
  query: string,
  input: { page: number; pageSize: number }
): Promise<PublicSearchPageResult> {
  const pageSize = Math.min(100, Math.max(1, Math.floor(input.pageSize)));
  const requestedPage = Math.max(1, Math.floor(input.page));
  const first = await readSearchPage(
    env,
    query,
    pageSize,
    (requestedPage - 1) * pageSize,
    "search:page-with-count"
  );

  if (first.rows.length > 0 || requestedPage === 1) {
    const totalItems = first.totalItems;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    return {
      rows: first.rows,
      page: Math.min(requestedPage, totalPages),
      pageSize,
      totalItems
    };
  }

  // Preserve the historical clamped-page contract only for out-of-range requests.
  // Normal search traffic stays on the single COUNT(*) OVER() query above.
  const totalItems = await countSearchRows(env, query);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(requestedPage, totalPages);

  if (totalItems === 0) {
    return { rows: [], page: 1, pageSize, totalItems: 0 };
  }

  const clamped = await readSearchPage(env, query, pageSize, (page - 1) * pageSize, "search:page-clamped");
  return {
    rows: clamped.rows,
    page,
    pageSize,
    totalItems
  };
}
