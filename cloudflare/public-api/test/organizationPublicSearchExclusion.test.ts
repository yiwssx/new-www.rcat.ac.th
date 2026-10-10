// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import {
  searchPublishedContentRows,
  countSearchPublishedContentRows,
  searchPublishedContentPageRows
} from "../src/db/contentRepository";
import { searchPublishedContentPageWithCountRows } from "../src/db/publicSearchRepository";

describe("Phase 8 public search Organization privacy boundary", () => {
  it("all generic search paths exclude organization CMS rows before any pagination", async () => {
    const queries: string[] = [];
    const db = {
      prepare(sql: string) {
        queries.push(sql);
        return {
          bind() { return this; },
          async all() { return { results: [], success: true }; }
        };
      }
    } as unknown as D1Database;
    const env = { DB: db } as Env;
    await searchPublishedContentRows(env, "ฝ่ายวิชาการ");
    await countSearchPublishedContentRows(env, "ฝ่ายวิชาการ");
    await searchPublishedContentPageRows(env, "ฝ่ายวิชาการ", { limit: 10, offset: 0 });
    await searchPublishedContentPageWithCountRows(env, "ฝ่ายวิชาการ", { page: 1, pageSize: 12 });

    expect(queries.length).toBe(4);
    for (const query of queries) {
      expect(query).toContain("type <> 'organization'");
    }
  });
});
