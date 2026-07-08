import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import { EVENT_ROW_COLUMNS, type EventRow } from "./schema";

export async function listPublicEventRows(env: Env): Promise<EventRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${EVENT_ROW_COLUMNS.join(", ")}
       FROM events
       WHERE visibility = ?
         AND status = ?
       ORDER BY date ASC, updated_at DESC`
    )
    .bind("public", "confirmed")
    .all<EventRow>();

  return result.results ?? [];
}
