// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import migrationSql from "../migrations/0020_organization_content_foundation.sql?raw";
import {
  mapPublicOrganizationPositions,
  PUBLIC_ORGANIZATION_POSITIONS_SQL,
  type PublicOrganizationPositionRow
} from "../src/db/organizationReadRepository";

const NOW = "2026-10-09T14:00:00.000Z";
let db: DatabaseSync;

function addContent(id: string, status = "published") {
  db.prepare(
    "INSERT INTO contents (id, type, status, slug, title, publish_at, unpublish_at) " +
      "VALUES (?, 'organization', ?, ?, ?, '', '')"
  ).run(id, status, id, id);
}

function addUnit(id: string, parent: string | null = null) {
  const statement = db.prepare(
    "INSERT INTO organization_units (content_id, parent_content_id, unit_kind) VALUES (?, ?, 'work')"
  );
  statement.run(id, parent);
}

function addPosition(id: string, unitId: string) {
  const statement = db.prepare(
    "INSERT INTO organization_positions (id, unit_content_id, title) VALUES (?, ?, 'Manager')"
  );
  statement.run(id, unitId);
}

function addPerson(id: string, options: { active?: number; showEmail?: number; showPhone?: number } = {}) {
  const statement = db.prepare(
    "INSERT INTO personnel (id, display_name, personnel_type, employment_position, " +
      "public_email, public_phone, show_public_email, show_public_phone, active) " +
      "VALUES (?, ?, 'teacher', 'Instructor', ?, ?, ?, ?, ?)"
  );
  statement.run(
    id,
    `Sample ${id}`,
    `${id}@example.invalid`,
    "0123456789",
    options.showEmail ?? 0,
    options.showPhone ?? 0,
    options.active ?? 1
  );
}

function addAssignment(
  id: string,
  personId: string,
  positionId: string,
  options: { enabled?: number; duty?: string } = {}
) {
  const statement = db.prepare(
    "INSERT INTO organization_assignments " +
      "(id, personnel_id, position_id, duty_detail, enabled) " +
      "VALUES (?, ?, ?, ?, ?)"
  );
  statement.run(id, personId, positionId, options.duty ?? "", options.enabled ?? 1);
}

function visiblePositions() {
  const rows = db.prepare(PUBLIC_ORGANIZATION_POSITIONS_SQL).all(NOW) as unknown as PublicOrganizationPositionRow[];
  return mapPublicOrganizationPositions(rows);
}

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE contents (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      deleted_at TEXT NOT NULL DEFAULT '',
      publish_at TEXT NOT NULL DEFAULT '',
      unpublish_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE media_assets (id TEXT PRIMARY KEY);
  `);
  db.exec(migrationSql);
});

afterEach(() => {
  db.close();
});

describe("Organization Chart public positions and assignments", () => {
  it("excludes positions under a draft ancestor and its published descendants", () => {
    addContent("division", "draft");
    addContent("work");
    addUnit("division");
    addUnit("work", "division");
    addPosition("pos-work", "work");
    addPerson("person-1");
    addAssignment("assignment-1", "person-1", "pos-work");

    expect(visiblePositions()).toEqual([]);
  });

  it("never exposes unpublished units or positions", () => {
    addContent("division");
    addContent("work", "draft");
    addUnit("division");
    addUnit("work", "division");
    addPosition("pos-work", "work");

    expect(visiblePositions()).toEqual([]);
  });

  it("uses manual enabled flags and active personnel, preserving empty positions", () => {
    addContent("division");
    addUnit("division");
    addPosition("pos-1", "division");
    addPerson("disabled", { active: 0 });
    addPerson("enabled");
    addAssignment("a-disabled-person", "disabled", "pos-1");
    addAssignment("a-disabled-assignment", "enabled", "pos-1", { enabled: 0 });

    const positions = visiblePositions();
    expect(positions).toHaveLength(1);
    expect(positions[0]?.assignments).toEqual([]);
  });

  it("changes public visibility only when the administrator changes enabled, never by time", () => {
    addContent("division");
    addUnit("division");
    addPosition("pos", "division");
    addPerson("p1");
    addAssignment("manual", "p1", "pos");

    expect(visiblePositions()[0]?.assignments.map((item) => item.id)).toEqual(["manual"]);
    db.prepare("UPDATE organization_assignments SET enabled = 0, revision = 1 WHERE id = 'manual'").run();
    expect(visiblePositions()[0]?.assignments).toEqual([]);
    db.prepare("UPDATE organization_assignments SET enabled = 1, revision = 2 WHERE id = 'manual'").run();
    expect(visiblePositions()[0]?.assignments.map((item) => item.id)).toEqual(["manual"]);
  });

  it("redacts default-private contact details, permits explicit opt-in, and allows multiple duties", () => {
    addContent("division");
    addUnit("division");
    addPosition("pos-1", "division");
    addPerson("private");
    addPerson("public", { showEmail: 1, showPhone: 1 });
    addAssignment("a1", "private", "pos-1", { duty: "Coordinator" });
    addAssignment("a2", "public", "pos-1", { duty: "Manager" });
    addAssignment("a3", "public", "pos-1", { duty: "Assistant" });

    const positions = visiblePositions();
    expect(positions).toHaveLength(1);
    expect(positions[0]?.assignments).toHaveLength(3);
    expect(positions[0]?.assignments[0]?.person).toMatchObject({
      id: "private",
      publicEmail: "",
      publicPhone: ""
    });
    expect(positions[0]?.assignments[1]?.person).toMatchObject({
      id: "public",
      publicEmail: "public@example.invalid",
      publicPhone: "0123456789"
    });
    expect(positions[0]?.assignments[2]?.person.id).toBe("public");
    expect(JSON.stringify(positions)).not.toContain("private@example.invalid");
  });
});
