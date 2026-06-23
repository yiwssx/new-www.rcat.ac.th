import { describe, expect, it } from "vitest";
import migration from "../migrations/0006_m20_visitor_presence.sql?raw";
import { VISITOR_PRESENCE_ROW_COLUMNS } from "../src/db/schema";

describe("M20 visitor presence migration", () => {
  it("creates daily pseudonymous presence without seed data", () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS visitor_presence/i);
    expect(migration).toMatch(/UNIQUE\s*\(day, visitor_id\)/i);
    expect(migration).toMatch(/CREATE INDEX IF NOT EXISTS idx_visitor_presence_last_seen/i);
    expect(migration).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(VISITOR_PRESENCE_ROW_COLUMNS).toEqual(["id", "visitor_id", "day", "path", "last_seen_at", "created_at"]);
  });
});
