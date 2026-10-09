// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import migrationSql from "../migrations/0020_organization_content_foundation.sql?raw";
import {
  createOrganizationAssignmentRow,
  createOrganizationPositionRow,
  createOrganizationUnitRow,
  createPersonnelRow,
  listAdminOrganizationAssignments,
  listAdminOrganizationPositions,
  listAdminOrganizationUnits,
  listAdminPersonnel,
  updateOrganizationAssignmentRow,
  updateOrganizationPositionRow,
  updateOrganizationUnitRow,
  updatePersonnelRow
} from "../src/db/organizationAdminRepository";
import type {
  OrganizationAssignmentRow,
  OrganizationPositionRow,
  OrganizationUnitRow,
  PersonnelRow
} from "../src/db/organizationSchema";
import type { Env } from "../src/env";

let db: DatabaseSync;
let env: Env;

function d1Fixture(): D1Database {
  return {
    prepare(query: string) {
      let bindings: unknown[] = [];
      return {
        bind(...values: unknown[]) {
          bindings = values;
          return this;
        },
        async run() {
          const result = db.prepare(query).run(...(bindings as never[]));
          return { success: true, meta: { changes: Number(result.changes) } };
        },
        async all<T>() {
          return { success: true, results: db.prepare(query).all(...(bindings as never[])) as T[] };
        }
      };
    }
  } as unknown as D1Database;
}

const unit: OrganizationUnitRow = {
  content_id: "division",
  parent_content_id: null,
  unit_kind: "division",
  sort_order: 0,
  settings_json: "{}",
  revision: 500,
  created_at: "2026-10-09T00:00:00.000Z",
  updated_at: "2026-10-09T00:00:00.000Z"
};

const person: PersonnelRow = {
  id: "p1",
  display_name: "Alice",
  personnel_type: "teacher",
  employment_position: "Instructor",
  photo_media_id: null,
  public_email: "alice@example.invalid",
  public_phone: "0000000000",
  show_public_email: 0,
  show_public_phone: 0,
  active: 1,
  revision: 99,
  created_at: "2026-10-09T00:00:00.000Z",
  updated_at: "2026-10-09T00:00:00.000Z"
};

const position: OrganizationPositionRow = {
  id: "post1",
  unit_content_id: "division",
  title: "Head",
  group_label: "",
  group_sort_order: 0,
  sort_order: 0,
  display_style: "default",
  occupant_limit: 1,
  revision: 300,
  created_at: "2026-10-09T00:00:00.000Z",
  updated_at: "2026-10-09T00:00:00.000Z"
};

const assignment: OrganizationAssignmentRow = {
  id: "a1",
  personnel_id: "p1",
  position_id: "post1",
  duty_detail: "Head of work",
  sort_order: 0,
  starts_at: "",
  ends_at: "",
  enabled: 1,
  revision: 400,
  created_at: "2026-10-09T00:00:00.000Z",
  updated_at: "2026-10-09T00:00:00.000Z"
};

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE contents (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, deleted_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE media_assets (id TEXT PRIMARY KEY);
    INSERT INTO contents (id, type) VALUES ('division', 'organization');
  `);
  db.exec(migrationSql);
  env = { DB: d1Fixture() };
});

afterEach(() => {
  db.close();
});

describe("Organization Chart D1 internal write repository", () => {
  it("creates bounded, related entities with server-owned initial revision zero", async () => {
    await createOrganizationUnitRow(env, unit);
    await createPersonnelRow(env, person);
    await createOrganizationPositionRow(env, position);
    await createOrganizationAssignmentRow(env, assignment);

    expect((await listAdminOrganizationUnits(env))[0]?.revision).toBe(0);
    expect((await listAdminPersonnel(env))[0]?.revision).toBe(0);
    expect((await listAdminOrganizationPositions(env))[0]?.revision).toBe(0);
    expect((await listAdminOrganizationAssignments(env))[0]?.revision).toBe(0);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("performs atomic revision compare-and-swap on all four domain tables", async () => {
    await createOrganizationUnitRow(env, unit);
    await createPersonnelRow(env, person);
    await createOrganizationPositionRow(env, position);
    await createOrganizationAssignmentRow(env, assignment);

    expect(await updateOrganizationUnitRow(env, { ...unit, sort_order: 2 }, 0)).toBe(true);
    expect(await updatePersonnelRow(env, { ...person, display_name: "Alice Updated" }, 0)).toBe(true);
    expect(await updateOrganizationPositionRow(env, { ...position, sort_order: 4 }, 0)).toBe(true);
    expect(await updateOrganizationAssignmentRow(env, { ...assignment, duty_detail: "Advisor" }, 0)).toBe(true);

    expect(await updateOrganizationUnitRow(env, unit, 0)).toBe(false);
    expect(await updatePersonnelRow(env, person, 0)).toBe(false);
    expect(await updateOrganizationPositionRow(env, position, 0)).toBe(false);
    expect(await updateOrganizationAssignmentRow(env, assignment, 0)).toBe(false);

    expect((await listAdminOrganizationUnits(env))[0]).toMatchObject({ sort_order: 2, revision: 1 });
    expect((await listAdminPersonnel(env))[0]).toMatchObject({ display_name: "Alice Updated", revision: 1 });
    expect((await listAdminOrganizationPositions(env))[0]).toMatchObject({ sort_order: 4, revision: 1 });
    expect((await listAdminOrganizationAssignments(env))[0]).toMatchObject({ duty_detail: "Advisor", revision: 1 });
  });

  it("rejects invalid revisions and unbounded Admin reads", async () => {
    await createPersonnelRow(env, person);

    await expect(updatePersonnelRow(env, person, -1)).rejects.toThrow(/expected revision/);
    await expect(updatePersonnelRow(env, person, 0.5)).rejects.toThrow(/expected revision/);
    await expect(listAdminPersonnel(env, 501)).rejects.toThrow(/page size/);
    expect((await listAdminPersonnel(env, 1)).map((row) => row.id)).toEqual(["p1"]);
  });

  it("binds hostile data as a value without executing injected SQL", async () => {
    const hostile = "X'); DROP TABLE contents; --";
    await createPersonnelRow(env, { ...person, display_name: hostile });
    expect((await listAdminPersonnel(env))[0]?.display_name).toBe(hostile);
    expect(db.prepare("SELECT COUNT(*) AS total FROM contents").get()).toMatchObject({ total: 1 });
  });
});
