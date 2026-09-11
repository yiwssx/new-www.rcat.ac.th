import type { Env } from "../env";
import {
  PUBLIC_CONTENT_SUMMARY_READ_COLUMNS,
  type PublicContentSummaryReadRow
} from "./contentRepository";
import { logD1QueryUsage } from "./d1QueryUsage";
import { requireD1Database } from "./documentsRepository";
import { PUBLIC_PUBLISHED_CONTENT_FILTER_SQL, publicPublishedContentBindings } from "./publicContentVisibility";

const HOME_NEWS_LIMIT = 6;
const HOME_ANNOUNCEMENT_LIMIT = 8;
const HOME_PROGRAM_LIMIT = 8;
const HOME_ACHIEVEMENT_LIMIT = 6;
const ACHIEVEMENT_TERMS = [
  "achievement",
  "award",
  "รางวัล",
  "ผลงาน",
  "ความสำเร็จ",
  "ความภาคภูมิใจ",
  "ชนะเลิศ",
  "รองชนะเลิศ",
  "เหรียญ"
] as const;
const ACHIEVEMENT_COLUMNS = ["title", "summary", "category", "tags_json"] as const;

async function readHomeRows(
  env: Env,
  queryName: string,
  extraFilterSql: string,
  bindings: unknown[],
  limit: number
): Promise<PublicContentSummaryReadRow[]> {
  const result = await requireD1Database(env)
    .prepare(
      `SELECT ${PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE ${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND COALESCE(deleted_at, '') = ''
         ${extraFilterSql}
       ORDER BY publish_at DESC, updated_at DESC
       LIMIT ?`
    )
    .bind(...publicPublishedContentBindings(...bindings, limit))
    .all<PublicContentSummaryReadRow>();

  logD1QueryUsage(env, queryName, result);
  return result.results ?? [];
}

function createAchievementFilter() {
  const clauses: string[] = [];
  const bindings: string[] = [];

  ACHIEVEMENT_TERMS.forEach((term) => {
    const pattern = `%${term}%`;
    ACHIEVEMENT_COLUMNS.forEach((column) => {
      clauses.push(`${column} LIKE ?`);
      bindings.push(pattern);
    });
  });

  return {
    sql: `AND (${clauses.join(" OR ")})`,
    bindings
  };
}

export async function listHomePublishedContentSummaryRows(env: Env): Promise<PublicContentSummaryReadRow[]> {
  const achievementFilter = createAchievementFilter();
  const [news, announcements, programs, achievements] = await Promise.all([
    readHomeRows(env, "home:content:news", "AND type IN (?, ?)", ["news", "blog"], HOME_NEWS_LIMIT),
    readHomeRows(
      env,
      "home:content:announcements",
      "AND type = ?",
      ["announcement"],
      HOME_ANNOUNCEMENT_LIMIT
    ),
    readHomeRows(env, "home:content:programs", "AND type = ?", ["program"], HOME_PROGRAM_LIMIT),
    readHomeRows(
      env,
      "home:content:achievements",
      achievementFilter.sql,
      achievementFilter.bindings,
      HOME_ACHIEVEMENT_LIMIT
    )
  ]);

  const rowsById = new Map<string, PublicContentSummaryReadRow>();
  [...news, ...announcements, ...programs, ...achievements].forEach((row) => {
    if (!rowsById.has(row.id)) {
      rowsById.set(row.id, row);
    }
  });

  return [...rowsById.values()];
}
