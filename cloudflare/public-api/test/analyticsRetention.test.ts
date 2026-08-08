// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getPublicAnalyticsRetentionCutoffs, prunePublicAnalyticsData } from "../src/analyticsRetention";

function createRetentionDb() {
  const statements: Array<{ query: string; bindings: unknown[] }> = [];

  const db = {
    prepare(query: string) {
      const entry = { query, bindings: [] as unknown[] };
      statements.push(entry);
      return {
        bind(...bindings: unknown[]) {
          entry.bindings = bindings;
          return this;
        }
      };
    },
    async batch() {
      return [];
    }
  } as unknown as D1Database;

  return { db, statements };
}

describe("public analytics retention", () => {
  it("keeps raw events for 90 days and presence for two days", () => {
    const now = new Date("2026-08-08T12:00:00.000Z");

    expect(getPublicAnalyticsRetentionCutoffs(now)).toEqual({
      now: "2026-08-08T12:00:00.000Z",
      rawEventCutoff: "2026-05-10T12:00:00.000Z",
      presenceCutoff: "2026-08-06T12:00:00.000Z"
    });
  });

  it("prunes only short-lived and raw analytics tables", async () => {
    const { db, statements } = createRetentionDb();

    await prunePublicAnalyticsData({ DB: db }, new Date("2026-08-08T12:00:00.000Z"));

    expect(statements.map(({ query }) => query)).toEqual([
      "DELETE FROM public_write_rate_limits WHERE expires_at < ?",
      "DELETE FROM visitor_presence WHERE last_seen_at < ?",
      "DELETE FROM visitor_events WHERE created_at < ?",
      "DELETE FROM content_view_events WHERE created_at < ?"
    ]);
    expect(statements.map(({ bindings }) => bindings)).toEqual([
      ["2026-08-08T12:00:00.000Z"],
      ["2026-08-06T12:00:00.000Z"],
      ["2026-05-10T12:00:00.000Z"],
      ["2026-05-10T12:00:00.000Z"]
    ]);
  });
});
