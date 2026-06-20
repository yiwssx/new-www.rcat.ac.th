import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import { CONTENT_ROW_COLUMNS, type ContentRow } from "./schema";

const PUBLISHED_STATUS = "published";
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

export async function listPublishedContentRows(env: Env, type: string): Promise<PublicContentReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE status = ?
         AND type = ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC`
    )
    .bind(PUBLISHED_STATUS, type)
    .all<PublicContentReadRow>();

  return result.results ?? [];
}

export async function listAllPublishedContentRows(env: Env): Promise<PublicContentReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE status = ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC`
    )
    .bind(PUBLISHED_STATUS)
    .all<PublicContentReadRow>();

  return result.results ?? [];
}

export async function listFeaturedContentRows(env: Env): Promise<PublicContentReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE status = ?
         AND featured = ?
         AND type <> ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC
       LIMIT 6`
    )
    .bind(PUBLISHED_STATUS, 1, PROGRAM_TYPE)
    .all<PublicContentReadRow>();

  return result.results ?? [];
}

export async function getPublishedContentRowBySlug(env: Env, slug: string): Promise<PublicContentReadRow | null> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE status = ?
         AND (slug = ? OR id = ?)
         AND COALESCE(deleted_at, '') = ''
       LIMIT 1`
    )
    .bind(PUBLISHED_STATUS, slug, slug)
    .all<PublicContentReadRow>();

  return result.results?.[0] ?? null;
}

export async function searchPublishedContentRows(env: Env, query: string): Promise<PublicContentReadRow[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return listAllPublishedContentRows(env);
  }

  const pattern = `%${normalizedQuery}%`;
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE status = ?
         AND COALESCE(deleted_at, '') = ''
         AND (
           title LIKE ?
           OR summary LIKE ?
           OR body_snapshot LIKE ?
           OR category LIKE ?
         )
       ORDER BY publish_at DESC, updated_at DESC
       LIMIT 20`
    )
    .bind(PUBLISHED_STATUS, pattern, pattern, pattern, pattern)
    .all<PublicContentReadRow>();

  return result.results ?? [];
}

export function validateContentReadColumnContract() {
  return PUBLIC_CONTENT_READ_COLUMNS.filter((column) => column !== "owner").every((column) =>
    CONTENT_ROW_COLUMNS.includes(column as (typeof CONTENT_ROW_COLUMNS)[number])
  );
}
