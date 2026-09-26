// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildRecoveryUpsertSql } from "../src/routes/adminBackupRecovery";

describe("backup recovery UPSERT builder", () => {
  it("updates by the stable primary key without REPLACE semantics", () => {
    const sql = buildRecoveryUpsertSql("contents", ["id", "slug", "title"], ["id"]);

    expect(sql).toBe(
      'INSERT INTO "contents" ("id", "slug", "title") VALUES (?, ?, ?) ON CONFLICT ("id") DO UPDATE SET "slug" = excluded."slug", "title" = excluded."title"'
    );
    expect(sql).not.toMatch(/\bREPLACE\b/i);
  });

  it("supports composite primary keys and leaves key-only rows unchanged", () => {
    expect(buildRecoveryUpsertSql("visitor_daily_stats", ["day"], ["day"])).toBe(
      'INSERT INTO "visitor_daily_stats" ("day") VALUES (?) ON CONFLICT ("day") DO NOTHING'
    );

    expect(buildRecoveryUpsertSql("example_table", ["a", "b", "value"], ["a", "b"])).toBe(
      'INSERT INTO "example_table" ("a", "b", "value") VALUES (?, ?, ?) ON CONFLICT ("a", "b") DO UPDATE SET "value" = excluded."value"'
    );
  });

  it("fails closed when the backup row omits any primary-key column", () => {
    expect(() => buildRecoveryUpsertSql("contents", ["slug", "title"], ["id"])).toThrow(
      "backup row does not contain the table primary key"
    );
  });

  it("rejects unsafe identifiers instead of interpolating them", () => {
    expect(() => buildRecoveryUpsertSql("contents; DROP TABLE contents", ["id"], ["id"])).toThrow(
      /invalid database identifier/
    );
  });
});
