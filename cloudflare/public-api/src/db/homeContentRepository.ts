import { logD1QueryMetrics } from "../d1QueryMetrics";
import type { Env } from "../env";
import { PUBLIC_CONTENT_SUMMARY_READ_COLUMNS, type PublicContentSummaryReadRow } from "./contentRepository";
import { requireD1Database } from "./documentsRepository";
import { PUBLIC_PUBLISHED_CONTENT_FILTER_SQL, publicPublishedContentBindings } from "./publicContentVisibility";

const HOME_NEWS_LIMIT = 6;
const HOME_ANNOUNCEMENT_LIMIT = 8;
const HOME_PROGRAM_LIMIT = 8;
const HOME_ACHIEVEMENT_LIMIT = 6;
const ACHIEVEMENT_PATTERNS = [
  "%achievement%",
  "%award%",
  "%รางวัล%",
  "%ผลงาน%",
  "%ความสำเร็จ%",
  "%ความภาคภูมิใจ%",
  "%ชนะเลิศ%",
  "%รองชนะเลิศ%",
  "%เหรียญ%"
] as const;

async function readHomeRows(env: Env, operation: string, query: string, bindings: unknown[]) {
  const result = await requireD1Database(env)
    .prepare(query)
    .bind(...bindings)
    .all<PublicContentSummaryReadRow>();

  logD1QueryMetrics(env, operation, result);
  return result.results ?? [];
}

function dedupeRows(groups: PublicContentSummaryReadRow[][]) {
  const rows = new Map<string, PublicContentSummaryReadRow>();

  groups.flat().forEach((row) => {
    if (!rows.has(row.id)) {
      rows.set(row.id, row);
    }
  });

  return [...rows.values()];
}

export async function listHomePublishedContentSummaryRows(env: Env): Promise<PublicContentSummaryReadRow[]> {
  const columns = PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ");
  const achievementText =
    "LOWER(COALESCE(title, '') || ' ' || COALESCE(summary, '') || ' ' || COALESCE(category, '') || ' ' || COALESCE(tags_json, ''))";
  const achievementFilter = ACHIEVEMENT_PATTERNS.map(() => `${achievementText} LIKE ?`).join(" OR ");

  const [news, announcements, programs, achievements] = await Promise.all([
    readHomeRows(
      env,
      "public.home.content.news",
      `SELECT ${columns}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND type IN (?, ?)
         AND deleted_at = ''
       ORDER BY publish_at DESC, updated_at DESC
       LIMIT ?`,
      publicPublishedContentBindings("news", "blog", HOME_NEWS_LIMIT)
    ),
    readHomeRows(
      env,
      "public.home.content.announcements",
      `SELECT ${columns}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND type = ?
         AND deleted_at = ''
       ORDER BY publish_at DESC, updated_at DESC
       LIMIT ?`,
      publicPublishedContentBindings("announcement", HOME_ANNOUNCEMENT_LIMIT)
    ),
    readHomeRows(
      env,
      "public.home.content.programs",
      `SELECT ${columns}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND type = ?
         AND deleted_at = ''
       ORDER BY publish_at DESC, updated_at DESC
       LIMIT ?`,
      publicPublishedContentBindings("program", HOME_PROGRAM_LIMIT)
    ),
    readHomeRows(
      env,
      "public.home.content.achievements",
      `SELECT ${columns}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND deleted_at = ''
         AND (${achievementFilter})
       ORDER BY publish_at DESC, updated_at DESC
       LIMIT ?`,
      publicPublishedContentBindings(...ACHIEVEMENT_PATTERNS, HOME_ACHIEVEMENT_LIMIT)
    )
  ]);

  return dedupeRows([news, announcements, programs, achievements]);
}
