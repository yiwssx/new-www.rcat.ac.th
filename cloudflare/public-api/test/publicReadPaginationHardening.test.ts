import { describe, expect, it } from "vitest";
import {
  countPublishedContentSummaryRows,
  countSearchPublishedContentRows,
  listPublishedContentSummaryPageRows,
  searchPublishedContentPageRows
} from "../src/db/contentRepository";
import { readPublicMediaRowsByIds } from "../src/db/publicMetadataRepository";
import type { Env } from "../src/env";
import publicContentRouteSource from "../src/routes/publicContent.ts?raw";
import publicSearchRouteSource from "../src/routes/publicSearch.ts?raw";

interface DbCall {
  query: string;
  bindings: unknown[];
}

function createMockEnv() {
  const calls: DbCall[] = [];
  const DB = {
    prepare(query: string) {
      const call: DbCall = { query, bindings: [] };
      calls.push(call);

      return {
        bind(...bindings: unknown[]) {
          call.bindings.push(...bindings);
          return this;
        },
        async all<T>() {
          if (/COUNT\(\*\)\s+AS\s+total_items/i.test(query)) {
            return { results: [{ total_items: 37 }] as T[] };
          }

          return { results: [] as T[] };
        }
      };
    }
  } as unknown as D1Database;

  return {
    calls,
    env: { DB } satisfies Env
  };
}

describe("Step 4 public-read hardening", () => {
  it("uses COUNT plus LIMIT/OFFSET for paginated content reads", async () => {
    const { calls, env } = createMockEnv();

    await expect(countPublishedContentSummaryRows(env, "news")).resolves.toBe(37);
    await listPublishedContentSummaryPageRows(env, "news", { limit: 12, offset: 24 });

    expect(calls).toHaveLength(2);
    expect(calls[0].query).toMatch(/SELECT COUNT\(\*\) AS total_items[\s\S]*FROM contents/i);
    expect(calls[1].query).toMatch(/ORDER BY publish_at DESC, updated_at DESC[\s\S]*LIMIT \? OFFSET \?/i);
    expect(calls[1].bindings.slice(-3)).toEqual(["news", 12, 24]);
  });

  it("uses COUNT plus LIMIT/OFFSET for query-specific search reads", async () => {
    const { calls, env } = createMockEnv();

    await expect(countSearchPublishedContentRows(env, "award")).resolves.toBe(37);
    await searchPublishedContentPageRows(env, "award", { limit: 12, offset: 12 });

    expect(calls).toHaveLength(2);
    expect(calls[0].query).toMatch(/COUNT\(\*\)[\s\S]*title LIKE \?[\s\S]*body_snapshot LIKE \?/i);
    expect(calls[1].query).toMatch(/LIMIT \? OFFSET \?/i);
    expect(calls[1].bindings.slice(-2)).toEqual([12, 12]);
    expect(calls[1].bindings.filter((value) => value === "%award%")).toHaveLength(5);
  });

  it("loads only explicitly referenced public media ids", async () => {
    const { calls, env } = createMockEnv();

    await readPublicMediaRowsByIds(env, ["media-a", "media-b", "media-a", ""]);

    expect(calls).toHaveLength(1);
    expect(calls[0].query).toMatch(/FROM media_assets[\s\S]*WHERE id IN \(\?, \?\)/i);
    expect(calls[0].bindings).toEqual(["media-a", "media-b"]);
  });

  it("keeps public content and search routes off full metadata/media table reads", () => {
    expect(publicContentRouteSource).toContain("countPublishedContentSummaryRows");
    expect(publicContentRouteSource).toContain("listPublishedContentSummaryPageRows");
    expect(publicContentRouteSource).toContain("readPublicMediaRowsByIds");
    expect(publicContentRouteSource).not.toContain("readPublicMediaRows(env)");
    expect(publicContentRouteSource).not.toContain("readPublicMetadataRows(env)");

    expect(publicSearchRouteSource).toContain("countSearchPublishedContentRows");
    expect(publicSearchRouteSource).toContain("searchPublishedContentPageRows");
    expect(publicSearchRouteSource).toContain("readPublicShellMetadataRows");
    expect(publicSearchRouteSource).not.toContain("readPublicMetadataRows(env)");
  });
});
