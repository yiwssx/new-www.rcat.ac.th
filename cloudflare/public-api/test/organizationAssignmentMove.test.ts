// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import migration from "../migrations/0020_organization_content_foundation.sql?raw";
import type { Env } from "../src/env";
import { moveAuditedOrganizationAssignment } from "../src/db/organizationAssignmentMove";

let db: DatabaseSync;
let env: Env;
function d1(): D1Database {
  return {
    prepare(sql: string) {
      let bindings: unknown[] = [];
      return {
        bind(...values: unknown[]) {
          bindings = values;
          return this;
        },
        async run() {
          const r = db.prepare(sql).run(...(bindings as never[]));
          return { success: true, meta: { changes: Number(r.changes) } };
        }
      };
    },
    async batch(items: { run: () => Promise<unknown> }[]) {
      db.exec("BEGIN");
      try {
        const result = [];
        for (const item of items) result.push(await item.run());
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  } as unknown as D1Database;
}
function position(id: string, unit: string, capacity: number | null = null) {
  db.prepare(
    "INSERT INTO organization_positions (id, unit_content_id, title, occupant_limit, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, unit, id, capacity, "2026-10-18T00:00:00.000Z");
}
function assignment(id: string, person: string, positionId: string, rank: number, enabled = 1) {
  db.prepare(
    "INSERT INTO organization_assignments (id, personnel_id, position_id, sort_order, enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, person, positionId, rank, enabled, "2026-10-18T00:00:00.000Z");
}
function current(id: string) {
  return db.prepare("SELECT * FROM organization_assignments WHERE id = ?").get(id) as {
    id: string;
    position_id: string;
    sort_order: number;
    revision: number;
    personnel_id: string;
    enabled: number;
  };
}
function auditCount() {
  return (db.prepare("SELECT COUNT(*) AS total FROM admin_audit_log").get() as { total: number }).total;
}
const move = (destinationPositionId: string, expectedRevision = 0) =>
  moveAuditedOrganizationAssignment(
    env,
    {
      id: "source",
      expectedRevision,
      expectedSourcePositionId: "position-a",
      destinationPositionId,
      personnelId: "person-a"
    },
    "editor"
  );
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE contents (id TEXT PRIMARY KEY, type TEXT NOT NULL, deleted_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE media_assets (id TEXT PRIMARY KEY);
    CREATE TABLE admin_audit_log (
      id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      action TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL, metadata_json TEXT NOT NULL
    );
    INSERT INTO contents (id, type) VALUES ('division-a','organization'),('division-b','organization');
  `);
  db.exec(migration);
  db.exec(`
    INSERT INTO organization_units (content_id, unit_kind) VALUES ('division-a','division'),('division-b','division');
    INSERT INTO personnel (id, display_name) VALUES ('person-a','One'),('person-b','Two'),('person-c','Three');
  `);
  position("position-a", "division-a", 1);
  position("position-b", "division-b", 2);
  position("position-c", "division-b", 1);
  assignment("source", "person-a", "position-a", 0);
  env = { DB: d1() } as Env;
});
afterEach(() => db.close());

describe("organization cross-unit DnD assignment transfer", () => {
  it("moves the only source occupant across units and appends to the destination atomically", async () => {
    assignment("existing", "person-b", "position-b", 9);
    expect(await move("position-b")).toBe(true);
    expect(current("source")).toMatchObject({
      personnel_id: "person-a",
      position_id: "position-b",
      sort_order: 10,
      revision: 1,
      enabled: 1
    });
    expect(auditCount()).toBe(1);
    expect(
      JSON.parse(
        (db.prepare("SELECT metadata_json FROM admin_audit_log").get() as { metadata_json: string }).metadata_json
      )
    ).toMatchObject({ operation: "transfer", fromPositionId: "position-a", toPositionId: "position-b" });
    expect(current("existing").revision).toBe(0);
    expect((db.prepare("SELECT COUNT(*) AS c FROM personnel").get() as { c: number }).c).toBe(3);
  });
  it("accepts empty destination without fabricating a duplicate personnel", async () => {
    expect(await move("position-b")).toBe(true);
    expect(current("source").sort_order).toBe(0);
    expect(auditCount()).toBe(1);
  });
  it("refuses stale revision, same target and target with duplicate enabled occupant with no audit", async () => {
    expect(await move("position-b", 42)).toBe(false);
    expect(await move("position-a")).toBe(false);
    assignment("duplicate", "person-a", "position-b", 0);
    expect(await move("position-b")).toBe(false);
    expect(current("source").position_id).toBe("position-a");
    expect(current("source").revision).toBe(0);
    expect(auditCount()).toBe(0);
  });
  it("refuses full capacity, missing target, and never partially audits", async () => {
    assignment("occupied", "person-c", "position-c", 0);
    await expect(move("position-c")).rejects.toThrow(/occupant limit/);
    await expect(move("missing-target")).rejects.toThrow(/FOREIGN KEY/);
    expect(current("source").position_id).toBe("position-a");
    expect(auditCount()).toBe(0);
  });
  it("retains unrelated concurrent assignments and manual deactivation state", async () => {
    assignment("other", "person-a", "position-c", 3, 0);
    expect(await move("position-b")).toBe(true);
    expect(current("other")).toMatchObject({ position_id: "position-c", enabled: 0, revision: 0 });
  });
});
