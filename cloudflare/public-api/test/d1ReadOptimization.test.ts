import { describe, expect, it } from "vitest";
import { listHomePublishedContentSummaryRows } from "../src/db/homeContentRepository";
import { listHomePublishedDocumentRows } from "../src/db/homeDocumentsRepository";
import { searchPublishedContentPageWithCountRows } from "../src/db/publicSearchRepository";
import { readVisitorStatsAggregate } from "../src/db/visitorStatsRepository";
import type { Env } from "../src/env";

function createDb(handler: (query: string, bindings: unknown[]) => unknown[]) {
  const calls: Array<{ query: string; bindings: unknown[] }> = [];
  const env: Env = {
    ENVIRONMENT: "test",
    DB: {
      prepare(query: string) {
        const call = { query, bindings: [] as unknown[] };
        calls.push(call);
        return {
          bind(...bindings: unknown[]) {
            call.bindings.push(...bindings);
            return this;
          },
          async all<T>() {
            return {
              results: handler(query, call.bindings) as T[],
              success: true,
              meta: { rows_read: 1, rows_written: 0, duration: 0.1 }
            };
          }
        };
      }
    } as unknown as D1Database
  };

  return { env, calls };
}

const contentRow = {
  id: "content-1",
  slug: "content-1",
  type: "news",
  status: "published",
  owner: "",
  title: "Award news",
  summary: "Achievement",
  category: "award",
  tags_json: "[]",
  seo_title: "",
  seo_description: "",
  canonical_url: "",
  featured: 0,
  reading_minutes: 1,
  template: "",
  featured_media_id: "",
  media_ids_json: "[]",
  view_count: 0,
  last_viewed_at: "",
  publish_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z"
};

describe("D1 public read optimization", () => {
  it("bounds each homepage content section in SQL", async () => {
    const { env, calls } = createDb((query) => (/FROM contents/i.test(query) ? [contentRow] : []));

    await listHomePublishedContentSummaryRows(env);

    const contentCalls = calls.filter((call) => /FROM contents/i.test(call.query));
    expect(contentCalls).toHaveLength(4);
    expect(contentCalls.every((call) => /LIMIT \?/i.test(call.query))).toBe(true);
    expect(contentCalls.some((call) => /type IN \(\?, \?\)/i.test(call.query))).toBe(true);
    expect(contentCalls.some((call) => /title LIKE \?/i.test(call.query))).toBe(true);
  });

  it("bounds homepage documents to the three cards rendered by the homepage", async () => {
    const documentRows = Array.from({ length: 6 }, (_, index) => ({
      id: `doc-${index + 1}`,
      title: `Document ${index + 1}`,
      description: "",
      category: "",
      file_url: "",
      file_name: "",
      media_id: "",
      published_at: "2026-09-01T00:00:00.000Z",
      status: "published",
      sort_order: index,
      pinned: 0,
      updated_at: "2026-09-01T00:00:00.000Z"
    }));
    const { env, calls } = createDb((query) => (/FROM documents/i.test(query) ? documentRows : []));

    const rows = await listHomePublishedDocumentRows(env);

    expect(rows).toHaveLength(3);
    expect(calls[0]?.query).toMatch(/LIMIT \?/i);
    expect(calls[0]?.bindings.at(-1)).toBe(3);
  });

  it("returns visitor totals from one aggregate daily-stats query", async () => {
    const { env, calls } = createDb((query) =>
      /FROM visitor_daily_stats/i.test(query)
        ? [
            {
              total_views: 120,
              today_views: 10,
              users_today: 7,
              users_yesterday: 5,
              users_this_month: 40,
              users_this_year: 100,
              total_users: 110,
              updated_at: "2026-09-11T09:00:00.000Z"
            }
          ]
        : []
    );

    const aggregate = await readVisitorStatsAggregate(env, new Date("2026-09-11T09:00:00.000Z"));

    expect(aggregate).toMatchObject({
      total: 120,
      today: 10,
      usersToday: 7,
      usersYesterday: 5,
      usersThisMonth: 40,
      usersThisYear: 100,
      totalUsers: 110
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.query).toMatch(/SUM\(CASE WHEN[\s\S]+THEN total_views ELSE 0 END\)/i);
    expect(calls[0]?.query).toMatch(/SUM\(CASE WHEN[\s\S]+THEN unique_visitors ELSE 0 END\)/i);
    expect(calls[0]?.bindings).toHaveLength(5);
  });

  it("gets paginated search rows and total count in the same normal-path query", async () => {
    const { env, calls } = createDb((query) =>
      /COUNT\(\*\) OVER\(\)/i.test(query) ? [{ ...contentRow, total_items: 9 }] : []
    );

    const result = await searchPublishedContentPageWithCountRows(env, "award", { page: 1, pageSize: 20 });

    expect(result.totalItems).toBe(9);
    expect(result.rows).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.query).toMatch(/COUNT\(\*\) OVER\(\)/i);
    expect(calls[0]?.query).toMatch(/LIMIT \? OFFSET \?/i);
  });
});
