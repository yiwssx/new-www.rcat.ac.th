// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import migrationSql from "../migrations/0020_organization_content_foundation.sql?raw";
import type { Env } from "../src/env";
import { parseOrganizationReorder, reorderOrganizationRows } from "../src/routes/adminOrganizationReorder";

let db: DatabaseSync;
let env: Env;
const now = "2026-10-10T00:00:00.000Z";

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

function position(id: string, groupLabel = "") {
  db.prepare(
    "INSERT INTO organization_positions (id, unit_content_id, title, group_label, updated_at) VALUES (?, 'division', ?, ?, ?)"
  ).run(id, id, groupLabel, now);
}
function assignment(id: string, personnel: string, positionId = "pos-a") {
  db.prepare(
    "INSERT INTO organization_assignments (id, personnel_id, position_id, updated_at) VALUES (?, ?, ?, ?)"
  ).run(id, personnel, positionId, now);
}
function orders(table: string) {
  return db
    .prepare(`SELECT id, sort_order, revision FROM ${table} ORDER BY sort_order ASC, id ASC`)
    .all()
    .map((row) => row as { id: string; sort_order: number; revision: number });
}
function auditCount() {
  return (db.prepare("SELECT COUNT(*) AS total FROM admin_audit_log").get() as { total: number }).total;
}

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
    INSERT INTO contents (id, type) VALUES ('division', 'organization');
  `);
  db.exec(migrationSql);
  db.exec(`
    INSERT INTO organization_units (content_id, unit_kind) VALUES ('division', 'division');
    INSERT INTO personnel (id, display_name) VALUES ('p1', 'One'), ('p2', 'Two'), ('p3', 'Three');
  `);
  env = { DB: d1() } as Env;
});
afterEach(() => db.close());

describe("Phase 6 atomic DnD reorder", () => {
  it("accepts only complete scoped, unique and revisioned items", () => {
    const valid = {
      collection: "positions",
      scopeId: "division",
      groupLabel: "Leadership",
      groupSortOrder: 0,
      items: [{ id: "pos-a", revision: 0 }, { id: "pos-b", revision: 0 }]
    };
    expect(parseOrganizationReorder(valid)).toMatchObject(valid);
    expect(() => parseOrganizationReorder({ ...valid, items: [valid.items[0], valid.items[0]] })).toThrow();
    expect(() => parseOrganizationReorder({ ...valid, items: [{ id: "pos-a", revision: -1 }] })).toThrow();
    expect(() => parseOrganizationReorder({ ...valid, injected: true })).toThrow();
    expect(() => parseOrganizationReorder({ ...valid, scopeId: "../division" })).toThrow();
    expect(() => parseOrganizationReorder({ ...valid, groupSortOrder: -3 })).toThrow();
    expect(() => parseOrganizationReorder({ ...valid, collection: "assignments", groupLabel: "Leadership" })).toThrow();
  });

  it("atomically reorders all sibling positions, bumps versions and audits once", async () => {
    position("pos-a", "Group");
    position("pos-b", "Group");
    position("pos-c", "Group");
    const result = await reorderOrganizationRows(
      env,
      {
        collection: "positions",
        scopeId: "division",
        groupLabel: "Group",
        groupSortOrder: 0,
        items: [{ id: "pos-c", revision: 0 }, { id: "pos-a", revision: 0 }, { id: "pos-b", revision: 0 }]
      },
      "editor"
    );
    expect(result).toBe(true);
    expect(orders("organization_positions")).toEqual([
      { id: "pos-c", sort_order: 0, revision: 1 },
      { id: "pos-a", sort_order: 1, revision: 1 },
      { id: "pos-b", sort_order: 2, revision: 1 }
    ]);
    expect(auditCount()).toBe(1);
  });

  it("rejects stale revisions or an incomplete group with no partial writes or audit", async () => {
    position("pos-a");
    position("pos-b");
    position("pos-c");
    const incomplete = {
      collection: "positions" as const,
      scopeId: "division",
      groupLabel: "",
      groupSortOrder: 0,
      items: [{ id: "pos-b", revision: 0 }, { id: "pos-a", revision: 0 }]
    };
    expect(await reorderOrganizationRows(env, incomplete, "editor")).toBe(false);
    expect(auditCount()).toBe(0);
    expect(orders("organization_positions").every((item) => item.revision === 0)).toBe(true);

    const stale = {
      ...incomplete,
      items: [{ id: "pos-b", revision: 99 }, { id: "pos-a", revision: 0 }, { id: "pos-c", revision: 0 }]
    };
    expect(await reorderOrganizationRows(env, stale, "editor")).toBe(false);
    expect(auditCount()).toBe(0);
    expect(orders("organization_positions").every((item) => item.revision === 0)).toBe(true);
  });

  it("never crosses position groups or unit/position boundaries", async () => {
    position("pos-a", "Group");
    position("pos-b", "Group");
    position("pos-other", "Other");
    expect(
      await reorderOrganizationRows(
        env,
        {
          collection: "positions",
          scopeId: "division",
          groupLabel: "Group",
          groupSortOrder: 0,
          items: [{ id: "pos-other", revision: 0 }, { id: "pos-a", revision: 0 }]
        },
        "editor"
      )
    ).toBe(false);
    expect(auditCount()).toBe(0);
    expect(orders("organization_positions").every((item) => item.revision === 0)).toBe(true);
  });

  it("reorders duties without changing personnel, position or manual enabled flags", async () => {
    position("pos-a");
    position("pos-b");
    assignment("a", "p1");
    assignment("b", "p2");
    assignment("other", "p3", "pos-b");
    db.prepare("UPDATE organization_assignments SET enabled = 0, revision = 1 WHERE id = 'b'").run();
    const result = await reorderOrganizationRows(
      env,
      {
        collection: "assignments",
        scopeId: "pos-a",
        groupLabel: "",
        groupSortOrder: 0,
        items: [{ id: "b", revision: 1 }, { id: "a", revision: 0 }]
      },
      "editor"
    );
    expect(result).toBe(true);
    expect(
      db.prepare("SELECT personnel_id, position_id, enabled FROM organization_assignments WHERE id='b'").get()
    ).toMatchObject({ personnel_id: "p2", position_id: "pos-a", enabled: 0 });
    expect(orders("organization_assignments").find((item) => item.id === "other")?.revision).toBe(0);
    expect(auditCount()).toBe(1);
  });
});
