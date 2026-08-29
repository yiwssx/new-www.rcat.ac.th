import { describe, expect, it, vi } from "vitest";
import {
  aggregateD1AnalyticsGroups,
  buildD1UsageReport,
  classifyUsageRatio,
  fetchD1Analytics,
  formatD1UsageMarkdown
} from "../../scripts/check-production-d1-usage.mjs";

const sampleGroups = [
  {
    dimensions: { date: "2026-08-29", databaseId: "db-a" },
    sum: { rowsRead: 1_500_000, rowsWritten: 30_000, readQueries: 120, writeQueries: 80 }
  },
  {
    dimensions: { date: "2026-08-29", databaseId: "db-b" },
    sum: { rowsRead: 2_000_000, rowsWritten: 45_000, readQueries: 90, writeQueries: 70 }
  },
  {
    dimensions: { date: "2026-08-28", databaseId: "db-a" },
    sum: { rowsRead: 900_000, rowsWritten: 10_000, readQueries: 75, writeQueries: 25 }
  }
];

describe("production D1 usage guard", () => {
  it("classifies the configured utilization bands", () => {
    expect(classifyUsageRatio(0.49)).toBe("healthy");
    expect(classifyUsageRatio(0.5)).toBe("info");
    expect(classifyUsageRatio(0.7)).toBe("warning");
    expect(classifyUsageRatio(0.85)).toBe("critical");
  });

  it("aggregates account usage by UTC date and database", () => {
    const aggregated = aggregateD1AnalyticsGroups(sampleGroups);

    expect(aggregated.daily).toEqual([
      {
        date: "2026-08-28",
        rowsRead: 900_000,
        rowsWritten: 10_000,
        readQueries: 75,
        writeQueries: 25
      },
      {
        date: "2026-08-29",
        rowsRead: 3_500_000,
        rowsWritten: 75_000,
        readQueries: 210,
        writeQueries: 150
      }
    ]);
    expect(aggregated.databases[0]).toMatchObject({ databaseId: "db-a", rowsWritten: 40_000 });
  });

  it("reports the highest current-day severity across reads and writes", () => {
    const report = buildD1UsageReport({
      groups: sampleGroups,
      now: new Date("2026-08-29T10:00:00.000Z")
    });

    expect(report.current.rowsReadRatio).toBe(0.7);
    expect(report.current.rowsWrittenRatio).toBe(0.75);
    expect(report.severity).toBe("warning");
    expect(formatD1UsageMarkdown(report)).toContain("Rows written utilization: **75.0%**");
  });

  it("fails closed when thresholds are invalid", () => {
    expect(() =>
      buildD1UsageReport({
        groups: [],
        thresholds: { info: 0.7, warning: 0.6, critical: 0.85 }
      })
    ).toThrow("usage thresholds must be ordered");
  });

  it("queries Cloudflare GraphQL with the analytics bearer token", async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      expect(init.headers.Authorization).toBe("Bearer analytics-token");
      const body = JSON.parse(init.body);
      expect(body.variables).toEqual({
        accountTag: "account-id",
        start: "2026-08-16",
        end: "2026-08-29"
      });
      return new Response(
        JSON.stringify({
          data: {
            viewer: {
              accounts: [{ d1AnalyticsAdaptiveGroups: sampleGroups }]
            }
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    await expect(
      fetchD1Analytics({
        accountId: "account-id",
        token: "analytics-token",
        start: "2026-08-16",
        end: "2026-08-29",
        fetchImpl
      })
    ).resolves.toEqual(sampleGroups);
  });
});
