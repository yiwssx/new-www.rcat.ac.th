// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import migrationSql from "../migrations/0020_organization_content_foundation.sql?raw";
import {
  createAuditedOrganizationAssignment,
  createAuditedOrganizationPosition,
  getAdminOrganizationAssignmentById,
  getAdminOrganizationPositionById,
  updateAuditedOrganizationAssignment,
  updateAuditedOrganizationPosition
} from "../src/db/organizationDutyRepository";
import type { OrganizationAssignmentRow, OrganizationPositionRow } from "../src/db/organizationSchema";
import type { Env } from "../src/env";

let db: DatabaseSync;
let env: Env;
const createdAt = "2026-10-10T00:00:00.000Z";
const position: OrganizationPositionRow = {
  id: "pos1",
  unit_content_id: "division",
  title: "Head of Division",
  group_label: "Leadership",
  group_sort_order: 0,
  sort_order: 0,
  display_style: "default",
  occupant_limit: 1,
  revision: 999,
  created_at: createdAt,
  updated_at: createdAt
};
const assignment: OrganizationAssignmentRow = {
  id: "asg1",
  personnel_id: "p1",
  position_id: "pos1",
  duty_detail: "Manager",
  sort_order: 0,
  starts_at: "",
  ends_at: "",
  enabled: 1,
  revision: 999,
  created_at: createdAt,
  updated_at: createdAt
};

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
          const result = db.prepare(sql).run(...(bindings as never[]));
          return { success: true, meta: { changes: Number(result.changes) } };
        },
        async first<T>() {
          return (db.prepare(sql).get(...(bindings as never[])) ?? null) as T | null;
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

function count(table: "organization_positions" | "organization_assignments" | "admin_audit_log") {
  return Number((db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count);
}

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE contents (id TEXT PRIMARY KEY, type TEXT NOT NULL, deleted_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE media_assets (id TEXT PRIMARY KEY);
    CREATE TABLE admin_audit_log (
      id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      action TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL, metadata_json TEXT NOT NULL
    );
    INSERT INTO contents (id, type) VALUES ('division', 'organization');
  `);
  db.exec(migrationSql);
  db.exec(`
    INSERT INTO organization_units (content_id, unit_kind) VALUES ('division', 'division');
    INSERT INTO personnel (id, display_name) VALUES ('p1', 'Teacher One'), ('p2', 'Teacher Two');
  `);
  env = { DB: d1() };
});
afterEach(() => db.close());

describe("Organization Chart audited duty D1 operations", () => {
  it("creates positions and assignments in audit transactions with initial revision zero", async () => {
    await createAuditedOrganizationPosition(env, position, "editor");
    await createAuditedOrganizationAssignment(env, assignment, "editor");
    expect((await getAdminOrganizationPositionById(env, "pos1"))?.revision).toBe(0);
    expect((await getAdminOrganizationAssignmentById(env, "asg1"))?.revision).toBe(0);
    expect(count("admin_audit_log")).toBe(2);
  });

  it("increments both revisions and rejects stale updates without extra audit entries", async () => {
    await createAuditedOrganizationPosition(env, position, "editor");
    await createAuditedOrganizationAssignment(env, assignment, "editor");
    expect(await updateAuditedOrganizationPosition(env, { ...position, title: "Updated" }, 0, "editor", ["title"]))
      .toBe(true);
    expect(await updateAuditedOrganizationAssignment(env, { ...assignment, duty_detail: "Advisor" }, 0, "editor", ["dutyDetail"]))
      .toBe(true);
    expect(count("admin_audit_log")).toBe(4);
    expect(await updateAuditedOrganizationPosition(env, position, 0, "editor", ["title"])).toBe(false);
    expect(await updateAuditedOrganizationAssignment(env, assignment, 0, "editor", ["dutyDetail"])).toBe(false);
    expect(count("admin_audit_log")).toBe(4);
    expect((await getAdminOrganizationAssignmentById(env, "asg1"))?.duty_detail).toBe("Advisor");
  });

  it("rolls back assignment and audit when occupancy exceeds the position limit", async () => {
    await createAuditedOrganizationPosition(env, position, "editor");
    await createAuditedOrganizationAssignment(env, assignment, "editor");
    const attempted = { ...assignment, id: "asg2", personnel_id: "p2" };
    await expect(createAuditedOrganizationAssignment(env, attempted, "editor")).rejects.toThrow(/occupant limit/);
    expect(count("organization_assignments")).toBe(1);
    expect(count("admin_audit_log")).toBe(2);
  });

  it("rolls back on invalid foreign keys without misleading audit entries", async () => {
    await createAuditedOrganizationPosition(env, position, "editor");
    await expect(
      createAuditedOrganizationAssignment(env, { ...assignment, personnel_id: "unknown" }, "editor")
    ).rejects.toThrow();
    expect(count("organization_assignments")).toBe(0);
    expect(count("admin_audit_log")).toBe(1);
  });
});
