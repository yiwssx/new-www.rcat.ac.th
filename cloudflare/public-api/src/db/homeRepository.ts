import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import { PUBLIC_HOME_SECTION_ROW_COLUMNS, type PublicHomeSectionRow } from "./schema";

export async function listPublishedHomeSectionRows(env: Env): Promise<PublicHomeSectionRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${PUBLIC_HOME_SECTION_ROW_COLUMNS.join(", ")}
       FROM public_home_sections
       WHERE enabled = ?
       ORDER BY sort_order ASC, updated_at DESC`
    )
    .bind(1)
    .all<PublicHomeSectionRow>();

  return result.results ?? [];
}
