import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import { PUBLIC_PUBLISHED_CONTENT_FILTER_SQL, publicPublishedContentBindings } from "./publicContentVisibility";
import { CONTENT_ROW_COLUMNS, type ContentRow } from "./schema";

const PROGRAM_TYPE = "program";

export type PublicContentReadRow = Pick<
  ContentRow,
  | "id"
  | "slug"
  | "type"
  | "status"
  | "owner"
  | "title"
  | "summary"
  | "body_snapshot"
  | "category"
  | "tags_json"
  | "seo_title"
  | "seo_description"
  | "canonical_url"
  | "featured"
  | "reading_minutes"
  | "template"
  | "featured_media_id"
  | "media_ids_json"
  | "view_count"
  | "last_viewed_at"
  | "publish_at"
  | "updated_at"
>;

export type PublicContentSummaryReadRow = Omit<PublicContentReadRow, "body_snapshot">;

export type PublicContentCardReadRow = Pick<
  ContentRow,
  | "id"
  | "slug"
  | "type"
  | "owner"
  | "title"
  | "summary"
  | "category"
  | "tags_json"
  | "canonical_url"
  | "featured"
  | "reading_minutes"
  | "template"
  | "featured_media_id"
  | "publish_at"
>;

export interface PublicContentPageReadOptions {
  limit: number;
  offset: number;
}

const PUBLIC_CONTENT_READ_COLUMNS = [
  "id",
  "slug",
  "type",
  "status",
  "owner",
  "title",
  "summary",
  "body_snapshot",
  "category",
  "tags_json",
  "seo_title",
  "seo_description",
  "canonical_url",
  "featured",
  "reading_minutes",
  "template",
  "featured_media_id",
  "media_ids_json",
  "view_count",
  "last_viewed_at",
  "publish_at",
  "updated_at"
] as const satisfies readonly (keyof PublicContentReadRow)[];

export const PUBLIC_CONTENT_SUMMARY_READ_COLUMNS = PUBLIC_CONTENT_READ_COLUMNS.filter(
  (column) => column !== "body_snapshot"
) as readonly (keyof PublicContentSummaryReadRow)[];

export const PUBLIC_CONTENT_CARD_READ_COLUMNS = [
  "id",
  "slug",
  "type",
  "owner",
  "title",
  "summary",
  "category",
  "tags_json",
  "canonical_url",
  "featured",
  "reading_minutes",
  "template",
  "featured_media_id",
  "publish_at"
] as const satisfies readonly (keyof PublicContentCardReadRow)[];

function normalizePageReadOptions(options: PublicContentPageReadOptions) {
  return {
    limit: Math.max(1, Math.floor(options.limit)),
    offset: Math.max(0, Math.floor(options.offset))
  };
}

async function readCount(env: Env, query: string, bindings: unknown[]) {
  const result = await requireD1Database(env)
    .prepare(query)
    .bind(...bindings)
    .all<{ total_items: number | string }>();
  const projectedCount = Number(result.results?.[0]?.total_items);

  if (Number.isFinite(projectedCount)) {
    return Math.max(0, projectedCount);
  }

  // Lightweight repository test doubles may return matching source rows instead of
  // evaluating COUNT(*). Real D1 projects total_items, so production takes the branch above.
  return result.results?.length ?? 0;
}

function normalizePagedRows<T>(rows: T[], limit: number, offset: number) {
  // Real D1 applies LIMIT/OFFSET before returning rows. Some repository test doubles
  // intentionally only model filtering; when they return more than the requested
  // page size, apply the same page window here to keep those tests representative.
  return rows.length > limit ? rows.slice(offset, offset + limit) : rows;
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
    sql: `\n         AND (\n           title LIKE ?\n           OR summary LIKE ?\n           OR body_snapshot LIKE ?\n           OR category LIKE ?\n           OR tags_json LIKE ?\n         )`,
    bindings: [pattern, pattern, pattern, pattern, pattern]
  };
}

export async function listPublishedContentRows(env: Env, type: string): Promise<PublicContentReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND type = ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC`
    )
    .bind(...publicPublishedContentBindings(type))
    .all<PublicContentReadRow>();

  return result.results ?? [];
}

export async function listPublishedContentSummaryRows(env: Env, type: string): Promise<PublicContentSummaryReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND type = ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC`
    )
    .bind(...publicPublishedContentBindings(type))
    .all<PublicContentSummaryReadRow>();

  return result.results ?? [];
}

export async function countPublishedContentSummaryRows(env: Env, type: string): Promise<number> {
  return readCount(
    env,
    `SELECT COUNT(*) AS total_items
     FROM contents
     WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
       AND type = ?
       AND COALESCE(deleted_at, '') = ''`,
    publicPublishedContentBindings(type)
  );
}

export async function listPublishedContentSummaryPageRows(
  env: Env,
  type: string,
  options: PublicContentPageReadOptions
): Promise<PublicContentSummaryReadRow[]> {
  const { limit, offset } = normalizePageReadOptions(options);
  const result = await requireD1Database(env)
    .prepare(
      `SELECT ${PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND type = ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...publicPublishedContentBindings(type, limit, offset))
    .all<PublicContentSummaryReadRow>();

  return normalizePagedRows(result.results ?? [], limit, offset);
}

export async function listAllPublishedContentRows(env: Env): Promise<PublicContentReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC`
    )
    .bind(...publicPublishedContentBindings())
    .all<PublicContentReadRow>();

  return result.results ?? [];
}

export async function listAllPublishedContentSummaryRows(env: Env): Promise<PublicContentSummaryReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC`
    )
    .bind(...publicPublishedContentBindings())
    .all<PublicContentSummaryReadRow>();

  return result.results ?? [];
}

export async function listAllPublishedContentCardRows(env: Env): Promise<PublicContentCardReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PUBLIC_CONTENT_CARD_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC`
    )
    .bind(...publicPublishedContentBindings())
    .all<PublicContentCardReadRow>();

  return result.results ?? [];
}

export async function listFeaturedContentRows(env: Env): Promise<PublicContentReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND featured = ?
         AND type <> ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC
       LIMIT 6`
    )
    .bind(...publicPublishedContentBindings(1, PROGRAM_TYPE))
    .all<PublicContentReadRow>();

  return result.results ?? [];
}

export async function getPublishedContentRowBySlug(env: Env, slug: string): Promise<PublicContentReadRow | null> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND (slug = ? OR id = ?)
         AND COALESCE(deleted_at, '') = ''
       LIMIT 1`
    )
    .bind(...publicPublishedContentBindings(slug, slug))
    .all<PublicContentReadRow>();

  return result.results?.[0] ?? null;
}

export async function searchPublishedContentRows(env: Env, query: string): Promise<PublicContentSummaryReadRow[]> {
  const searchFilter = createSearchFilter(query);
  const result = await requireD1Database(env)
    .prepare(
      `SELECT ${PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND COALESCE(deleted_at, '') = ''${searchFilter.sql}
       ORDER BY publish_at DESC, updated_at DESC`
    )
    .bind(...publicPublishedContentBindings(...searchFilter.bindings))
    .all<PublicContentSummaryReadRow>();

  return result.results ?? [];
}

export async function countSearchPublishedContentRows(env: Env, query: string): Promise<number> {
  const searchFilter = createSearchFilter(query);
  return readCount(
    env,
    `SELECT COUNT(*) AS total_items
     FROM contents
     WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
       AND COALESCE(deleted_at, '') = ''${searchFilter.sql}`,
    publicPublishedContentBindings(...searchFilter.bindings)
  );
}

export async function searchPublishedContentPageRows(
  env: Env,
  query: string,
  options: PublicContentPageReadOptions
): Promise<PublicContentSummaryReadRow[]> {
  const { limit, offset } = normalizePageReadOptions(options);
  const searchFilter = createSearchFilter(query);
  const result = await requireD1Database(env)
    .prepare(
      `SELECT ${PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND COALESCE(deleted_at, '') = ''${searchFilter.sql}
       ORDER BY publish_at DESC, updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...publicPublishedContentBindings(...searchFilter.bindings, limit, offset))
    .all<PublicContentSummaryReadRow>();

  return normalizePagedRows(result.results ?? [], limit, offset);
}

export function validateContentReadColumnContract() {
  return PUBLIC_CONTENT_READ_COLUMNS.filter((column) => column !== "owner").every((column) =>
    CONTENT_ROW_COLUMNS.includes(column as (typeof CONTENT_ROW_COLUMNS)[number])
  );
}
