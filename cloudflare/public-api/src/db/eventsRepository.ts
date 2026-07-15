import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import { EVENT_ROW_COLUMNS, MEDIA_ASSET_ROW_COLUMNS, type EventRow, type MediaAssetRow } from "./schema";

function parseEventMediaIds(value: string) {
  try {
    const parsed: unknown = JSON.parse(value || "[]");

    return Array.isArray(parsed)
      ? parsed
          .map(String)
          .map((id) => id.trim())
          .filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export async function listPublicEventMediaRows(env: Env, events: EventRow[]): Promise<MediaAssetRow[]> {
  const ids = [...new Set(events.flatMap((event) => parseEventMediaIds(event.media_ids_json)))];

  if (!ids.length) {
    return [];
  }

  const db = requireD1Database(env);
  const rows: MediaAssetRow[] = [];

  for (let offset = 0; offset < ids.length; offset += 50) {
    const batch = ids.slice(offset, offset + 50);
    const placeholders = batch.map(() => "?").join(", ");

    const result = await db
      .prepare(
        `SELECT ${MEDIA_ASSET_ROW_COLUMNS.join(", ")}
         FROM media_assets
         WHERE id IN (${placeholders})
         ORDER BY updated_at DESC`
      )
      .bind(...batch)
      .all<MediaAssetRow>();

    rows.push(...(result.results ?? []));
  }

  return rows;
}

export async function listPublicEventRows(env: Env): Promise<EventRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${EVENT_ROW_COLUMNS.join(", ")}
       FROM events
       WHERE visibility = ?
         AND status = ?
       ORDER BY date DESC, updated_at DESC`
    )
    .bind("public", "confirmed")
    .all<EventRow>();

  return result.results ?? [];
}
