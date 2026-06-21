import { describe, expect, it } from "vitest";
import worker from "../src/index";

function createAnalyticsDb() {
  const visitors = new Set<string>();
  const visitorRows = new Map<string, Record<string, unknown>>();
  let contentViewCount = 0;
  const contentRow = {
    id: "content-1",
    slug: "published-news",
    type: "news",
    status: "published",
    owner: "editor",
    title: "Published news",
    summary: "Summary",
    body_snapshot: "Body",
    category: "news",
    tags_json: "[]",
    seo_title: "",
    seo_description: "",
    canonical_url: "",
    featured: 0,
    reading_minutes: 1,
    template: "standard",
    featured_media_id: "",
    media_ids_json: "[]",
    view_count: 4,
    last_viewed_at: "",
    publish_at: "2026-06-21T08:30:00+07:00",
    updated_at: "2026-06-21T08:30:00+07:00"
  };

  function prepare(query: string) {
    const statement = {
      query,
      bindings: [] as unknown[],
      bind(...bindings: unknown[]) {
        this.bindings = bindings;
        return this;
      },
      async first<T>() {
        if (/FROM visitor_events/i.test(query)) {
          return (visitors.has(String(this.bindings[0])) ? { id: "existing" } : null) as T | null;
        }
        return null;
      },
      async all<T>() {
        if (/FROM visitor_daily_stats/i.test(query)) {
          return { results: [...visitorRows.values()] as T[], success: true };
        }
        if (/FROM contents/i.test(query)) {
          const identifier = String(this.bindings[1] ?? "");
          return {
            results: (identifier === contentRow.slug || identifier === contentRow.id ? [contentRow] : []) as T[],
            success: true
          };
        }
        return { results: [] as T[], success: true };
      },
      async run() {
        if (/INSERT INTO visitor_events/i.test(query)) {
          visitors.add(String(this.bindings[1]));
        } else if (/INSERT INTO visitor_daily_stats/i.test(query)) {
          const day = String(this.bindings[0]);
          const uniqueIncrement = Number(this.bindings[1]);
          const current = visitorRows.get(day);
          visitorRows.set(day, {
            day,
            total_views: Number(current?.total_views ?? 0) + 1,
            unique_visitors: Number(current?.unique_visitors ?? 0) + uniqueIncrement,
            online_users: 0,
            updated_at: String(this.bindings[2])
          });
        } else if (/UPDATE contents/i.test(query)) {
          contentViewCount += 1;
        }
        return { success: true, meta: { changes: 1 } };
      }
    };
    return statement;
  }

  const db = {
    prepare,
    async batch(statements: Array<ReturnType<typeof prepare>>) {
      return Promise.all(statements.map((statement) => statement.run()));
    }
  } as unknown as D1Database;

  return { db, visitors, visitorRows, getContentViewCount: () => contentViewCount };
}

describe("Cloudflare public analytics writes", () => {
  it("records daily views and a day-bucketed unique approximation without raw identifiers", async () => {
    const state = createAnalyticsDb();
    const request = () =>
      new Request("https://public-api.example.test/api/public/site-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: "rcat_abcdefghijkl", path: "/news" })
      });

    expect((await worker.fetch(request(), { DB: state.db })).status).toBe(201);
    expect((await worker.fetch(request(), { DB: state.db })).status).toBe(201);

    const statsResponse = await worker.fetch(new Request("https://public-api.example.test/api/public/visitor-stats"), {
      DB: state.db
    });
    const stats = (await statsResponse.json()) as {
      today: number;
      totalViews: number;
      usersToday: number;
      onlineUsers: number;
    };

    expect(stats.today).toBe(2);
    expect(stats.totalViews).toBe(2);
    expect(stats.usersToday).toBe(1);
    expect(stats.onlineUsers).toBe(0);
    expect([...state.visitors]).toHaveLength(1);
    expect([...state.visitors][0]).toMatch(/^v1_[a-f0-9]{32}$/);
    expect([...state.visitors][0]).not.toContain("abcdefghijkl");
  });

  it("records published content views in D1", async () => {
    const state = createAnalyticsDb();
    const response = await worker.fetch(
      new Request("https://public-api.example.test/api/public/content-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "published-news" })
      }),
      { DB: state.db }
    );
    const payload = (await response.json()) as { id: string; viewCount: number };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ id: "content-1", viewCount: 5 });
    expect(state.getContentViewCount()).toBe(1);
  });
});
