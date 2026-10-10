// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import migrationSql from "../migrations/0020_organization_content_foundation.sql?raw";
import {
  createAuditedPersonnelRow,
  getAdminPersonnelById,
  updateAuditedPersonnelRow
} from "../src/db/organizationAdminRepository";
import type { PersonnelRow } from "../src/db/organizationSchema";
import type { Env } from "../src/env";

let database: DatabaseSync;
let env: Env;

const person: PersonnelRow = {
  id: "person-1",
  display_name: "Teacher",
  personnel_type: "teacher",
  employment_position: "Instructor",
  photo_media_id: null,
  public_email: "private@example.invalid",
  public_phone: "123",
  show_public_email: 0,
  show_public_phone: 0,
  active: 1,
  revision: 999,
  created_at: "2026-10-10T00:00:00.000Z",
  updated_at: "2026-10-10T00:00:00.000Z"
};

function sqliteD1(): D1Database {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          values = args;
          return this;
        },
        async run() {
          const result = database.prepare(query).run(...(values as never[]));
          return { success: true, meta: { changes: Number(result.changes) } };
        },
        async first<T>() {
          return (database.prepare(query).get(...(values as never[])) ?? null) as T | null;
        }
      };
    },
    async batch(statements: { run: () => Promise<unknown> }[]) {
      database.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }
  } as unknown as D1Database;
}

function auditCount() {
  return Number(
    (database.prepare("SELECT COUNT(*) AS count FROM admin_audit_log").get() as { count: number }).count
  );
}

beforeEach(() => {
  database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(`
    CREATE TABLE contents (id TEXT PRIMARY KEY, type TEXT NOT NULL, deleted_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE media_assets (id TEXT PRIMARY KEY);
    CREATE TABLE admin_audit_log (
      id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      action TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL,
      metadata_json TEXT NOT NULL
    );
  `);
  database.exec(migrationSql);
  env = { DB: sqliteD1() };
});

afterEach(() => database.close());

describe("Organization Chart atomic personnel and audit persistence", () => {
  it("persists personnel and audit together, ignoring client-supplied revisions", async () => {
    await createAuditedPersonnelRow(env, person, "editor@example.invalid");
    expect((await getAdminPersonnelById(env, person.id))?.revision).toBe(0);
    expect(auditCount()).toBe(1);
    expect(database.prepare("SELECT action, actor FROM admin_audit_log").get()).toMatchObject({
      action: "create",
      actor: "editor@example.invalid"
    });
  });

  it("increments revisions and audits only successful compare-and-swap updates", async () => {
    await createAuditedPersonnelRow(env, person, "editor");
    expect(await updateAuditedPersonnelRow(env, { ...person, display_name: "Changed" }, 0, "editor", ["displayName"]))
      .toBe(true);
    expect((await getAdminPersonnelById(env, person.id))?.revision).toBe(1);
    expect(auditCount()).toBe(2);
    const changed = database.prepare("SELECT metadata_json FROM admin_audit_log WHERE action = 'update'").get() as {
      metadata_json: string;
    };
    expect(JSON.parse(changed.metadata_json)).toMatchObject({
      changedFields: ["displayName"],
      expectedRevision: 0
    });
    expect(changed.metadata_json).not.toContain("private@example.invalid");
    expect(await updateAuditedPersonnelRow(env, { ...person, display_name: "Stale" }, 0, "editor", ["displayName"]))
      .toBe(false);
    expect(auditCount()).toBe(2);
    expect((await getAdminPersonnelById(env, person.id))?.display_name).toBe("Changed");
  });

  it("rolls back personnel insertion if audit recording is unavailable", async () => {
    database.exec("DROP TABLE admin_audit_log");
    await expect(createAuditedPersonnelRow(env, person, "editor")).rejects.toThrow(/no such table/);
    expect(await getAdminPersonnelById(env, person.id)).toBeNull();
  });
});
