// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import migrationSql from "../migrations/0020_organization_content_foundation.sql?raw";
import { deleteAuditedOrganizationEntity } from "../src/db/organizationDeleteRepository";
import type { Env } from "../src/env";

let db: DatabaseSync;
let env: Env;

function fakeD1(): D1Database {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      return {
        bind(...bindings: unknown[]) {
          values = bindings;
          return this;
        },
        async run() {
          const result = db.prepare(query).run(...(values as never[]));
          return { success: true, meta: { changes: Number(result.changes) } };
        }
      };
    },
    async batch(statements: { run: () => Promise<unknown> }[]) {
      db.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  } as unknown as D1Database;
}
function count(table: string) {
  return Number((db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count);
}

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE contents (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, deleted_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE media_assets (id TEXT PRIMARY KEY);
    CREATE TABLE admin_audit_log (
      id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      action TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL, metadata_json TEXT NOT NULL
    );
    INSERT INTO contents (id, type) VALUES ('unit', 'organization');
  `);
  db.exec(migrationSql);
  db.exec(`
    INSERT INTO organization_units (content_id, unit_kind) VALUES ('unit', 'division');
    INSERT INTO personnel (id, display_name) VALUES ('p1', 'Staff');
    INSERT INTO organization_positions (id, unit_content_id, title) VALUES ('pos1', 'unit', 'Head');
    INSERT INTO organization_assignments (id, personnel_id, position_id) VALUES ('a1', 'p1', 'pos1');
  `);
  env = { DB: fakeD1() };
});
afterEach(() => db.close());

describe("No implicit cascade for linked Organization records", () => {
  it("blocks deletion of referenced person and position, without emitting misleading audits", async () => {
    await expect(
      deleteAuditedOrganizationEntity(env, "personnel", "p1", 0, "editor", "2026-10-10T00:00:00.000Z")
    ).rejects.toThrow(/FOREIGN KEY/);
    await expect(
      deleteAuditedOrganizationEntity(env, "position", "pos1", 0, "editor", "2026-10-10T00:00:00.000Z")
    ).rejects.toThrow(/FOREIGN KEY/);
    expect(count("admin_audit_log")).toBe(0);
  });

  it("allows explicit assignment removal then safe position and personnel deletion", async () => {
    expect(await deleteAuditedOrganizationEntity(env, "assignment", "a1", 0, "editor", "2026-10-10T00:00:00.000Z"))
      .toBe(true);
    expect(await deleteAuditedOrganizationEntity(env, "position", "pos1", 0, "editor", "2026-10-10T00:00:00.000Z"))
      .toBe(true);
    expect(await deleteAuditedOrganizationEntity(env, "personnel", "p1", 0, "editor", "2026-10-10T00:00:00.000Z"))
      .toBe(true);
    expect(count("admin_audit_log")).toBe(3);
    expect(count("organization_positions")).toBe(0);
  });

  it("fails closed on stale revision without deleting or auditing", async () => {
    expect(await deleteAuditedOrganizationEntity(env, "assignment", "a1", 1, "editor", "2026-10-10T00:00:00.000Z"))
      .toBe(false);
    expect(count("admin_audit_log")).toBe(0);
    expect(count("organization_assignments")).toBe(1);
  });
});
