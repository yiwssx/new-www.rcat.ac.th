import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

function createAnalyticsDb(options: { presenceTableMissing?: boolean } = {}) {
  const visitorEvents: Array<{ id: string; visitorId: string; createdAt: string }> = [];
  const visitorPresence = new Map<
    string,
    { id: string; visitorId: string; day: string; path: string; lastSeenAt: string; createdAt: string }
  >();
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
        if (/FROM visitor_events/i.test(query) && /visitor_id\s*=\s*\?/i.test(query)) {
          const visitor = visitorEvents.find((event) => event.visitorId === String(this.bindings[0]));
          return (visitor ? { id: visitor.id } : null) as T | null;
        }
        return null;
      },
      async all<T>() {
        if (/FROM visitor_presence/i.test(query)) {
          if (options.presenceTableMissing) {
            throw new Error("no such table: visitor_presence");
          }

          const onlineSince = String(this.bindings[0] ?? "");
          const onlineVisitors = new Set(
            [...visitorPresence.values()]
              .filter((presence) => presence.lastSeenAt >= onlineSince)
              .map((presence) => presence.visitorId)
          );
          return { results: [{ online_users: onlineVisitors.size }] as T[], success: true };
        }
        if (/FROM visitor_daily_stats/i.test(query)) {
          return { results: [...visitorRows.values()] as T[], success: true };
        }
        if (/FROM contents/i.test(query)) {
          const identifier = String(this.bindings[2] ?? "");
          return {
            results: (identifier === contentRow.slug || identifier === contentRow.id ? [contentRow] : []) as T[],
            success: true
          };
        }
        return { results: [] as T[], success: true };
      },
      async run() {
        if (/INSERT INTO visitor_presence/i.test(query)) {
          if (options.presenceTableMissing) {
            throw new Error("no such table: visitor_presence");
          }

          const visitorId = String(this.bindings[1]);
          const current = visitorPresence.get(visitorId);
          visitorPresence.set(visitorId, {
            id: current?.id ?? String(this.bindings[0]),
            visitorId,
            day: String(this.bindings[2]),
            path: String(this.bindings[3]),
            lastSeenAt: String(this.bindings[4]),
            createdAt: current?.createdAt ?? String(this.bindings[5])
          });
        } else if (/INSERT INTO visitor_events/i.test(query)) {
          visitorEvents.push({
            id: String(this.bindings[0]),
            visitorId: String(this.bindings[1]),
            createdAt: String(this.bindings[5])
          });
        } else if (/INSERT INTO visitor_daily_stats/i.test(query) && /public-presence/i.test(query)) {
          const day = String(this.bindings[0]);
          const current = visitorRows.get(day);
          visitorRows.set(day, {
            day,
            total_views: Number(current?.total_views ?? 0),
            unique_visitors: Number(current?.unique_visitors ?? 0),
            online_users: Number(this.bindings[1]),
            updated_at: String(this.bindings[2])
          });
        } else if (/INSERT INTO visitor_daily_stats/i.test(query)) {
          const day = String(this.bindings[0]);
          const uniqueIncrement = Number(this.bindings[1]);
          const current = visitorRows.get(day);
          visitorRows.set(day, {
            day,
            total_views: Number(current?.total_views ?? 0) + 1,
            unique_visitors: Number(current?.unique_visitors ?? 0) + uniqueIncrement,
            online_users: Number(this.bindings[2]),
            updated_at: String(this.bindings[3])
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

  return { db, visitorEvents, visitorPresence, visitorRows, getContentViewCount: () => contentViewCount };
}

afterEach(() => {
  vi.useRealTimers();
});

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
    expect(stats.onlineUsers).toBe(1);
    expect(state.visitorEvents).toHaveLength(2);
    expect(new Set(state.visitorEvents.map((event) => event.visitorId)).size).toBe(1);
    expect(state.visitorEvents[0]?.visitorId).toMatch(/^v1_[a-f0-9]{32}$/);
    expect(state.visitorEvents[0]?.visitorId).not.toContain("abcdefghijkl");
  });

  it("counts distinct visitor presence in the last five minutes and excludes stale presence", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-22T04:00:00.000Z"));
    const state = createAnalyticsDb();
    const request = (visitorId: string) =>
      new Request("https://public-api.example.test/api/public/site-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, path: "/news" })
      });

    const firstResponse = await worker.fetch(request("rcat_abcdefghijkl"), { DB: state.db });
    await worker.fetch(request("rcat_mnopqrstuvwx"), { DB: state.db });
    await worker.fetch(request("rcat_abcdefghijkl"), { DB: state.db });

    expect(await readOnlineUsers(firstResponse)).toBe(1);
    expect(Number([...state.visitorRows.values()][0]?.online_users)).toBe(2);

    vi.setSystemTime(new Date("2026-06-22T04:06:00.000Z"));
    const statsResponse = await worker.fetch(new Request("https://public-api.example.test/api/public/visitor-stats"), {
      DB: state.db
    });
    expect(await readOnlineUsers(statsResponse)).toBe(0);
  });

  it("updates presence without inflating page views", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-22T04:00:00.000Z"));
    const state = createAnalyticsDb();
    const heartbeat = (visitorId: string) =>
      worker.fetch(
        new Request("https://public-api.example.test/api/public/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId, path: "/news" })
        }),
        { DB: state.db }
      );

    expect(await readOnlineUsers(await heartbeat("rcat_abcdefghijkl"))).toBe(1);
    expect(await readOnlineUsers(await heartbeat("rcat_abcdefghijkl"))).toBe(1);
    expect(await readOnlineUsers(await heartbeat("rcat_mnopqrstuvwx"))).toBe(2);
    expect(state.visitorPresence.size).toBe(2);
    expect([...state.visitorRows.values()][0]?.total_views).toBe(0);

    vi.setSystemTime(new Date("2026-06-22T04:06:00.000Z"));
    const statsResponse = await worker.fetch(new Request("https://public-api.example.test/api/public/visitor-stats"), {
      DB: state.db
    });
    expect(await readOnlineUsers(statsResponse)).toBe(0);
  });

  it("returns a migration diagnostic when visitor_presence is unavailable", async () => {
    const state = createAnalyticsDb({ presenceTableMissing: true });
    const response = await worker.fetch(
      new Request("https://public-api.example.test/api/public/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: "rcat_abcdefghijkl", path: "/news" })
      }),
      { DB: state.db }
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      diagnostic: "visitor-presence-schema-missing-v1",
      suggestedMigration: "run 0006_m20_visitor_presence.sql"
    });
  });

  it("rejects invalid visitor identifiers", async () => {
    const state = createAnalyticsDb();
    const response = await worker.fetch(
      new Request("https://public-api.example.test/api/public/site-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: "invalid", path: "/news" })
      }),
      { DB: state.db }
    );

    expect(response.status).toBe(400);
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

async function readOnlineUsers(response: Response) {
  const payload = (await response.json()) as { onlineUsers: number };
  return payload.onlineUsers;
}
