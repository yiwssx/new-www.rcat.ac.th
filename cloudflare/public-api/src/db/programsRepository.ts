import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import type { PublicContentReadRow } from "./contentRepository";

const PUBLISHED_STATUS = "published";
const PROGRAM_TYPE = "program";
const PROGRAM_COLUMNS = [
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

export async function listPublishedProgramRows(env: Env): Promise<PublicContentReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PROGRAM_COLUMNS.join(", ")}
       FROM contents
       WHERE status = ?
         AND type = ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC`
    )
    .bind(PUBLISHED_STATUS, PROGRAM_TYPE)
    .all<PublicContentReadRow>();

  return result.results ?? [];
}
