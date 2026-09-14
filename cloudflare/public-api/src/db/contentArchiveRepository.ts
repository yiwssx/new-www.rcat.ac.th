import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import {
  PUBLIC_CONTENT_CARD_READ_COLUMNS,
  PUBLIC_CONTENT_SUMMARY_READ_COLUMNS,
  type PublicContentCardReadRow,
  type PublicContentPageReadOptions,
  type PublicContentSummaryReadRow
} from "./contentRepository";
import { PUBLIC_PUBLISHED_CONTENT_FILTER_SQL, publicPublishedContentBindings } from "./publicContentVisibility";

export interface PublicContentArchiveFilters {
  tag?: string;
  category?: string;
}

function normalizePageReadOptions(options: PublicContentPageReadOptions) {
  return {
    limit: Math.max(1, Math.min(100, Math.floor(options.limit))),
    offset: Math.max(0, Math.floor(options.offset))
  };
}

function normalizePagedRows<T>(rows: T[], limit: number, offset: number) {
  // Real D1 applies LIMIT/OFFSET before returning rows. Some repository test doubles
  // intentionally model filtering without SQL pagination, so mirror D1's page window
  // only when the returned row set is larger than the requested page.
  return rows.length > limit ? rows.slice(offset, offset + limit) : rows;
}

function normalizeFilterValue(value: string | undefined) {
  return String(value || "")
    .trim()
    .slice(0, 120);
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function createArchiveFilter(filters: PublicContentArchiveFilters = {}) {
  const category = normalizeFilterValue(filters.category);
  const tag = normalizeFilterValue(filters.tag);
  const clauses: string[] = [];
  const bindings: string[] = [];

  if (category) {
    clauses.push("AND (',' || REPLACE(REPLACE(category, ', ', ','), ' ,', ',') || ',') LIKE ? ESCAPE '\\'");
    bindings.push(`%,${escapeLikePattern(category)},%`);
  }

  if (tag) {
    clauses.push("AND tags_json LIKE ? ESCAPE '\\'");
    bindings.push(`%${escapeLikePattern(JSON.stringify(tag))}%`);
  }

  return {
    sql: clauses.length ? `\n       ${clauses.join("\n       ")}` : "",
    bindings
  };
}

async function readCount(env: Env, query: string, bindings: unknown[]) {
  const result = await requireD1Database(env)
    .prepare(query)
    .bind(...bindings)
    .all<{ total_items: number | string }>();
  const projectedCount = Number(result.results?.[0]?.total_items);
  return Number.isFinite(projectedCount) ? Math.max(0, projectedCount) : (result.results?.length ?? 0);
}

export async function countPublishedContentArchiveRows(
  env: Env,
  type: string,
  filters: PublicContentArchiveFilters = {}
) {
  const archiveFilter = createArchiveFilter(filters);
  return readCount(
    env,
    `SELECT COUNT(*) AS total_items
     FROM contents
     WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
       AND type = ?
       AND COALESCE(deleted_at, '') = ''${archiveFilter.sql}`,
    publicPublishedContentBindings(type, ...archiveFilter.bindings)
  );
}

export async function listPublishedContentArchivePageRows(
  env: Env,
  type: string,
  filters: PublicContentArchiveFilters,
  options: PublicContentPageReadOptions
): Promise<PublicContentSummaryReadRow[]> {
  const { limit, offset } = normalizePageReadOptions(options);
  const archiveFilter = createArchiveFilter(filters);
  const result = await requireD1Database(env)
    .prepare(
      `SELECT ${PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND type = ?
         AND COALESCE(deleted_at, '') = ''${archiveFilter.sql}
       ORDER BY publish_at DESC, updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...publicPublishedContentBindings(type, ...archiveFilter.bindings, limit, offset))
    .all<PublicContentSummaryReadRow>();

  return normalizePagedRows(result.results ?? [], limit, offset);
}

export async function listRelatedPublishedContentCardRows(
  env: Env,
  type: string,
  excludedId: string,
  limit = 24
): Promise<PublicContentCardReadRow[]> {
  const boundedLimit = Math.max(3, Math.min(60, Math.floor(limit)));
  const result = await requireD1Database(env)
    .prepare(
      `SELECT ${PUBLIC_CONTENT_CARD_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND type = ?
         AND id <> ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC
       LIMIT ?`
    )
    .bind(...publicPublishedContentBindings(type, excludedId, boundedLimit))
    .all<PublicContentCardReadRow>();

  return result.results ?? [];
}
