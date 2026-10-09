// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import migrationSql from "../migrations/0020_organization_content_foundation.sql?raw";
import {
  ORGANIZATION_ASSIGNMENT_ROW_COLUMNS,
  ORGANIZATION_POSITION_ROW_COLUMNS,
  ORGANIZATION_UNIT_ROW_COLUMNS,
  PERSONNEL_ROW_COLUMNS
} from "../src/db/organizationSchema";

let db: DatabaseSync;

function content(id: string, type = "organization") {
  db.prepare("INSERT INTO contents (id, type, deleted_at) VALUES (?, ?, '')").run(id, type);
}

function unit(id: string, parentId: string | null = null) {
  db.prepare("INSERT INTO organization_units (content_id, parent_content_id, unit_kind) VALUES (?, ?, 'work')").run(
    id,
    parentId
  );
}

function person(id: string) {
  db.prepare("INSERT INTO personnel (id, display_name) VALUES (?, ?)").run(id, `Test Person ${id}`);
}

function position(id: string, unitContentId: string, occupantLimit: number | null = null) {
  db.prepare(
    "INSERT INTO organization_positions (id, unit_content_id, title, occupant_limit) VALUES (?, ?, 'Head', ?)"
  ).run(id, unitContentId, occupantLimit);
}

function assignment(id: string, personnelId: string, positionId: string, duty = "") {
  db.prepare(
    "INSERT INTO organization_assignments (id, personnel_id, position_id, duty_detail) VALUES (?, ?, ?, ?)"
  ).run(id, personnelId, positionId, duty);
}

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  // The real migration is applied after the already-existing CMS/media tables.
  db.exec(`
    CREATE TABLE contents (
      id TEXT PRIMARY KEY, type TEXT NOT NULL,
      deleted_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE media_assets (id TEXT PRIMARY KEY);
  `);
  db.exec(migrationSql);
});

afterEach(() => {
  db.close();
});

describe("Organization Chart phase 1 D1 foundation", () => {
  it("is append-only, creates four empty tables, and declares matching row columns", () => {
    expect(migrationSql).not.toMatch(/\b(?:DROP|ALTER)\s+TABLE\b/i);
    expect(migrationSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?contents\b/i);

    const contracts = {
      organization_units: ORGANIZATION_UNIT_ROW_COLUMNS,
      personnel: PERSONNEL_ROW_COLUMNS,
      organization_positions: ORGANIZATION_POSITION_ROW_COLUMNS,
      organization_assignments: ORGANIZATION_ASSIGNMENT_ROW_COLUMNS
    };

    for (const [name, expected] of Object.entries(contracts)) {
      const columns = db.prepare(`PRAGMA table_info(${name})`).all() as Array<{ name: string }>;
      expect(columns.map((column) => column.name), name).toEqual(expected);
      expect(db.prepare(`SELECT COUNT(*) AS total FROM ${name}`).get()).toMatchObject({ total: 0 });
    }
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("rejects non-organization content, missing parents, and cyclic hierarchies", () => {
    content("not-org", "news");
    expect(() => unit("not-org")).toThrow(/organization unit requires active organization content/);

    content("root");
    content("child");
    content("leaf");
    expect(() => unit("child", "root")).toThrow(/FOREIGN KEY constraint failed/);

    unit("root");
    unit("child", "root");
    unit("leaf", "child");

    const cycleWrite = db.prepare(
      "UPDATE organization_units SET parent_content_id = 'leaf', revision = 1 WHERE content_id = 'root'"
    );
    const selfLinkWrite = db.prepare(
      "UPDATE organization_units SET parent_content_id = 'leaf', revision = 1 WHERE content_id = 'leaf'"
    );
    expect(() => cycleWrite.run()).toThrow(/organization hierarchy cycle/);
    expect(() => selfLinkWrite.run()).toThrow();

    const root = db.prepare("SELECT parent_content_id FROM organization_units WHERE content_id = 'root'").get();
    expect(root).toMatchObject({ parent_content_id: null });
  });

  it("protects organization content and referenced parent, person, and position", () => {
    content("root");
    content("child");
    unit("root");
    unit("child", "root");
    person("p1");
    position("post1", "child");
    assignment("a1", "p1", "post1");

    expect(() => db.prepare("UPDATE contents SET type = 'news' WHERE id = 'child'").run()).toThrow();
    expect(() => db.prepare("UPDATE contents SET deleted_at = '2026-10-09' WHERE id = 'child'").run()).toThrow();
    expect(() => db.prepare("DELETE FROM organization_units WHERE content_id = 'root'").run()).toThrow();
    expect(() => db.prepare("DELETE FROM personnel WHERE id = 'p1'").run()).toThrow();
    expect(() => db.prepare("DELETE FROM organization_positions WHERE id = 'post1'").run()).toThrow();
  });

  it("allows a canonical person across units and multiple duties in one position", () => {
    content("division");
    content("department");
    unit("division");
    unit("department");
    person("p1");
    position("post1", "division");
    position("post2", "department");

    assignment("a1", "p1", "post1", "Director");
    assignment("a2", "p1", "post1", "Coordinator");
    assignment("a3", "p1", "post2", "Teacher");

    const count = db.prepare("SELECT COUNT(*) AS total FROM organization_assignments WHERE personnel_id = 'p1'").get();
    expect(count).toMatchObject({ total: 3 });
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("enforces occupant limits by distinct enabled personnel, not duty count", () => {
    content("division");
    unit("division");
    person("p1");
    person("p2");
    position("post1", "division", 1);

    assignment("a1", "p1", "post1", "Head");
    assignment("a2", "p1", "post1", "Advisor");
    expect(() => assignment("a3", "p2", "post1")).toThrow(/organization position at occupant limit/);
    const belowLimit = db.prepare("UPDATE organization_positions SET occupant_limit = 0, revision = 1 WHERE id = 'post1'");
    expect(() => belowLimit.run()).toThrow();
    db.prepare("UPDATE organization_assignments SET enabled = 0, revision = 1 WHERE id = 'a1'").run();
    db.prepare("UPDATE organization_assignments SET enabled = 0, revision = 1 WHERE id = 'a2'").run();
    assignment("a3", "p2", "post1");
    expect(db.prepare("SELECT COUNT(*) AS total FROM organization_assignments").get()).toMatchObject({ total: 3 });
  });

  it("blocks stale revision writes, malformed settings and invalid assignment ranges", () => {
    content("root");
    unit("root");
    person("p1");
    position("post1", "root");

    expect(() => db.prepare("UPDATE organization_units SET sort_order = 1 WHERE content_id = 'root'").run()).toThrow(
      /organization revision must advance/
    );
    const invalidSettings = db.prepare(
      "UPDATE organization_units SET settings_json = '{oops', revision = 1 WHERE content_id = 'root'"
    );
    const invalidPeriod = db.prepare(
      "INSERT INTO organization_assignments (id, personnel_id, position_id, starts_at, ends_at) " +
        "VALUES ('a1', 'p1', 'post1', '2026-12-01', '2026-11-01')"
    );
    expect(() => invalidSettings.run()).toThrow();
    expect(() => invalidPeriod.run()).toThrow();
    db.prepare("UPDATE organization_units SET sort_order = 1, revision = 1 WHERE content_id = 'root'").run();
    const current = db.prepare("SELECT revision FROM organization_units WHERE content_id = 'root'").get();
    expect(current).toMatchObject({ revision: 1 });
  });
});
