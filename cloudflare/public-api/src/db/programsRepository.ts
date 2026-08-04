import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import { PUBLIC_CONTENT_SUMMARY_READ_COLUMNS, type PublicContentSummaryReadRow } from "./contentRepository";
import { PUBLIC_PUBLISHED_CONTENT_FILTER_SQL, publicPublishedContentBindings } from "./publicContentVisibility";

const PROGRAM_TYPE = "program";

export async function listPublishedProgramRows(env: Env): Promise<PublicContentSummaryReadRow[]> {
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
    .bind(...publicPublishedContentBindings(PROGRAM_TYPE))
    .all<PublicContentSummaryReadRow>();

  return result.results ?? [];
}
