import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import { CONTENT_ROW_COLUMNS, type ContentRow } from "./schema";

const PUBLISHED_STATUS = "published";
const PROGRAM_TYPE = "program";

export type PublicContentReadRow = Pick<
  ContentRow,
  "id" | "slug" | "type" | "title" | "summary" | "body_snapshot" | "category" | "featured" | "publish_at" | "updated_at"
>;

const PUBLIC_CONTENT_READ_COLUMNS = [
  "id",
  "slug",
  "type",
  "title",
  "summary",
  "body_snapshot",
  "category",
  "featured",
  "publish_at",
  "updated_at"
] as const satisfies readonly (keyof PublicContentReadRow)[];

export async function listPublishedContentRows(env: Env): Promise<PublicContentReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE status = ?
         AND type <> ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC`
    )
    .bind(PUBLISHED_STATUS, PROGRAM_TYPE)
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
         AND slug = ?
         AND type <> ?
         AND COALESCE(deleted_at, '') = ''
       LIMIT 1`
    )
    .bind(PUBLISHED_STATUS, slug, PROGRAM_TYPE)
    .all<PublicContentReadRow>();

  return result.results?.[0] ?? null;
}

export async function searchPublishedContentRows(env: Env, query: string): Promise<PublicContentReadRow[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const pattern = `%${normalizedQuery}%`;
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE status = ?
         AND type <> ?
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
    .bind(PUBLISHED_STATUS, PROGRAM_TYPE, pattern, pattern, pattern, pattern)
    .all<PublicContentReadRow>();

  return result.results ?? [];
}

export function validateContentReadColumnContract() {
  return PUBLIC_CONTENT_READ_COLUMNS.every((column) => CONTENT_ROW_COLUMNS.includes(column));
}
