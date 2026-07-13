import { describe, expect, it } from "vitest";
import migration from "../migrations/0008_content_slug_tombstones.sql?raw";

describe("content slug tombstone migration", () => {
  it("changes only legacy soft-deleted slugs using the deterministic content ID tombstone", () => {
    const setClause = migration
      .match(/\bSET\s+([\s\S]+?)\s+WHERE\b/i)?.[1]
      .replace(/\s+/g, " ")
      .trim();

    expect(setClause).toBe("slug = '__deleted__:' || id");
    expect(migration).toMatch(/WHERE\s+COALESCE\(deleted_at,\s*''\)\s*<>\s*''/i);
    expect(migration).toMatch(/substr\(slug,\s*1,\s*length\('__deleted__:'\)\)\s*<>\s*'__deleted__:'/i);
  });

  it("is an idempotent data backfill without schema changes or sample rows", () => {
    expect(migration.match(/\bUPDATE\s+contents\b/gi)).toHaveLength(1);
    expect(migration).not.toMatch(/\b(?:INSERT|DELETE|ALTER|DROP|CREATE)\b/i);
  });
});
