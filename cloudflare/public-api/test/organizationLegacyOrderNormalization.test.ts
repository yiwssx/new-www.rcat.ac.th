// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import migrationSql from "../migrations/0020_organization_content_foundation.sql?raw";
import applySql from "../../../scripts/organization/legacy-order-apply.sql?raw";
import previewSql from "../../../scripts/organization/legacy-order-preview.sql?raw";

let db: DatabaseSync;

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE contents (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      deleted_at TEXT NOT NULL DEFAULT '',
      revision INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE media_assets (id TEXT PRIMARY KEY);
  `);
  db.exec(migrationSql);
});

afterEach(() => db.close());

function content(id: string, title: string) {
  db.prepare("INSERT INTO contents (id, type, title) VALUES (?, 'organization', ?)").run(id, title);
}

function unit(id: string, parentId: string | null, order = 0) {
  db.prepare(
    "INSERT INTO organization_units (content_id, parent_content_id, unit_kind, sort_order) VALUES (?, ?, 'work', ?)"
  ).run(id, parentId, order);
}

function position(id: string, unitId: string, group = "", order = 0) {
  db.prepare(
    "INSERT INTO organization_positions (id, unit_content_id, title, group_label, sort_order) VALUES (?, ?, 'Head', ?, ?)"
  ).run(id, unitId, group, order);
}

function assignment(id: string, personId: string, positionId: string, order = 0) {
  db.prepare(
    "INSERT INTO organization_assignments (id, personnel_id, position_id, sort_order) VALUES (?, ?, ?, ?)"
  ).run(id, personId, positionId, order);
}

function order(table: "organization_units" | "organization_positions" | "organization_assignments", id: string) {
  const key = table === "organization_units" ? "content_id" : "id";
  return db.prepare(`SELECT sort_order, revision FROM ${table} WHERE ${key} = ?`).get(id);
}

describe("one-time legacy organization order normalization", () => {
  it("repairs only collision scopes, preserves sibling intent and is idempotent", () => {
    content("a-root", "Alpha");
    content("b-root", "Beta");
    content("a-child", "Child in Alpha");
    content("b-child", "Child in Beta");
    unit("a-root", null);
    unit("b-root", null);
    unit("a-child", "a-root");
    unit("b-child", "b-root");

    db.prepare("INSERT INTO personnel (id, display_name) VALUES ('person-1', 'One'), ('person-2', 'Two')").run();
    position("post-1", "a-root");
    position("post-2", "a-root");
    position("post-3", "a-root", "", 8);
    position("post-alt", "a-root", "other");
    position("post-other-unit", "b-root");
    assignment("duty-1", "person-1", "post-1");
    assignment("duty-2", "person-2", "post-1");
    assignment("duty-other", "person-1", "post-alt");

    const pending = db.prepare(previewSql).all() as Array<{ kind: string; id: string }>;
    expect(pending.map((row) => `${row.kind}:${row.id}`).sort()).toEqual(
      ["unit:b-root", "position:post-2", "position:post-3", "assignment:duty-2"].sort()
    );
    const personnelBefore = db.prepare("SELECT * FROM personnel ORDER BY id").all();

    db.exec(applySql);

    expect(order("organization_units", "a-root")).toMatchObject({ sort_order: 0, revision: 0 });
    expect(order("organization_units", "b-root")).toMatchObject({ sort_order: 1, revision: 1 });
    expect(db.prepare("SELECT revision, updated_by FROM contents WHERE id = 'b-root'").get()).toMatchObject({
      revision: 1,
      updated_by: "organization-legacy-order-normalization"
    });
    expect(db.prepare("SELECT revision FROM contents WHERE id = 'a-root'").get()).toMatchObject({ revision: 0 });
    expect(order("organization_units", "a-child")).toMatchObject({ sort_order: 0, revision: 0 });
    expect(order("organization_units", "b-child")).toMatchObject({ sort_order: 0, revision: 0 });
    expect(order("organization_positions", "post-1")).toMatchObject({ sort_order: 0, revision: 0 });
    expect(order("organization_positions", "post-2")).toMatchObject({ sort_order: 1, revision: 1 });
    expect(order("organization_positions", "post-3")).toMatchObject({ sort_order: 2, revision: 1 });
    expect(order("organization_positions", "post-alt")).toMatchObject({ sort_order: 0, revision: 0 });
    expect(order("organization_positions", "post-other-unit")).toMatchObject({ sort_order: 0, revision: 0 });
    expect(order("organization_assignments", "duty-1")).toMatchObject({ sort_order: 0, revision: 0 });
    expect(order("organization_assignments", "duty-2")).toMatchObject({ sort_order: 1, revision: 1 });
    expect(order("organization_assignments", "duty-other")).toMatchObject({ sort_order: 0, revision: 0 });
    expect(db.prepare("SELECT * FROM personnel ORDER BY id").all()).toEqual(personnelBefore);
    expect(db.prepare(previewSql).all()).toEqual([]);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);

    const snapshot = {
      units: db.prepare("SELECT * FROM organization_units ORDER BY content_id").all(),
      positions: db.prepare("SELECT * FROM organization_positions ORDER BY id").all(),
      assignments: db.prepare("SELECT * FROM organization_assignments ORDER BY id").all(),
      contents: db.prepare("SELECT * FROM contents ORDER BY id").all()
    };
    db.exec(applySql);
    expect(db.prepare(previewSql).all()).toEqual([]);
    expect(db.prepare("SELECT * FROM organization_units ORDER BY content_id").all()).toEqual(snapshot.units);
    expect(db.prepare("SELECT * FROM organization_positions ORDER BY id").all()).toEqual(snapshot.positions);
    expect(db.prepare("SELECT * FROM organization_assignments ORDER BY id").all()).toEqual(snapshot.assignments);
    expect(db.prepare("SELECT * FROM contents ORDER BY id").all()).toEqual(snapshot.contents);
  });

  it("does not change sparse but collision-free manually assigned ranks", () => {
    content("root", "Root");
    unit("root", null);
    position("pos-1", "root", "", 0);
    position("pos-2", "root", "", 15);
    expect(db.prepare(previewSql).all()).toEqual([]);
    db.exec(applySql);
    expect(order("organization_positions", "pos-1")).toMatchObject({ sort_order: 0, revision: 0 });
    expect(order("organization_positions", "pos-2")).toMatchObject({ sort_order: 15, revision: 0 });
  });
});
