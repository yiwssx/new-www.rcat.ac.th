// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import migrationSql from "../migrations/0020_organization_content_foundation.sql?raw";
import { buildRecoveryUpsertSql, orderOrganizationUnitsForRestore } from "../src/routes/adminBackupRecovery";

describe("backup recovery UPSERT builder", () => {
  it("sorts organization restore parent before child even from unordered exports", () => {
    const rows = [
      { content_id: "grandchild", parent_content_id: "child" },
      { content_id: "child", parent_content_id: "root" },
      { content_id: "root", parent_content_id: null }
    ];
    expect(orderOrganizationUnitsForRestore(rows).map((row) => row.content_id)).toEqual([
      "root",
      "child",
      "grandchild"
    ]);
    expect(() =>
      orderOrganizationUnitsForRestore([
        { content_id: "left", parent_content_id: "right" },
        { content_id: "right", parent_content_id: "left" }
      ])
    ).toThrow(/cyclic/);
  });

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


  it("replays the same Organization snapshot without violating monotonic revision triggers", () => {
    const database = new DatabaseSync(":memory:");
    try {
      database.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE contents (
          id TEXT PRIMARY KEY, type TEXT NOT NULL, deleted_at TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE media_assets (id TEXT PRIMARY KEY);
      `);
      database.exec(migrationSql);
      database.exec(`
        INSERT INTO contents (id, type) VALUES ('unit1', 'organization');
        INSERT INTO organization_units (content_id, unit_kind) VALUES ('unit1', 'work');
        INSERT INTO personnel (id, display_name) VALUES ('person1', 'Original');
        INSERT INTO organization_positions (id, unit_content_id, title)
        VALUES ('position1', 'unit1', 'Teacher');
        INSERT INTO organization_assignments (id, personnel_id, position_id)
        VALUES ('assignment1', 'person1', 'position1');
      `);

      const fixtures = [
        ["organization_units", "content_id", "unit1"],
        ["personnel", "id", "person1"],
        ["organization_positions", "id", "position1"],
        ["organization_assignments", "id", "assignment1"]
      ] as const;

      for (const [table, key, id] of fixtures) {
        const snapshot = database.prepare(`SELECT * FROM ${table} WHERE ${key} = ?`).get(id) as Record<
          string,
          string | number | null
        >;
        const columns = Object.keys(snapshot);
        const statement = database.prepare(buildRecoveryUpsertSql(table, columns, [key]));
        // Both updates use the same old backup revision; each must advance
        // the live row revision, not reset it to the backup value.
        expect(() => statement.run(...Object.values(snapshot))).not.toThrow();
        expect(() => statement.run(...Object.values(snapshot))).not.toThrow();
        const row = database.prepare(`SELECT revision FROM ${table} WHERE ${key} = ?`).get(id);
        expect(row).toMatchObject({ revision: 2 });
      }
      expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      database.close();
    }
  });

  it("rejects unsafe identifiers instead of interpolating them", () => {
    expect(() => buildRecoveryUpsertSql("contents; DROP TABLE contents", ["id"], ["id"])).toThrow(
      /invalid database identifier/
    );
  });
});
