// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import migrationSql from "../migrations/0020_organization_content_foundation.sql?raw";
import { publicOrganizationDetail } from "../src/routes/publicOrganization";
import type { Env } from "../src/env";

let db: DatabaseSync;
let env: Env;

function addContent(id: string, parent: string | null = null, status = "published", publishAt = "", unpublishAt = "") {
  db.prepare(
    "INSERT INTO contents (id, type, slug, title, summary, status, publish_at, unpublish_at) " +
      "VALUES (?, 'organization', ?, ?, ?, ?, ?, ?)"
  ).run(id, id, id, `Summary ${id}`, status, publishAt, unpublishAt);
  db.prepare("INSERT INTO organization_units (content_id, parent_content_id, unit_kind) VALUES (?, ?, 'work')").run(
    id,
    parent
  );
}

function addPosition(id: string, unit: string) {
  db.prepare("INSERT INTO organization_positions (id, unit_content_id, title) VALUES (?, ?, ?)").run(
    id,
    unit,
    `Position ${id}`
  );
}

function addPerson(id: string, emailVisible = 0, active = 1) {
  db.prepare(
    "INSERT INTO personnel (id, display_name, public_email, public_phone, show_public_email, show_public_phone, active) " +
      "VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(id, `Person ${id}`, `${id}@example.invalid`, "0123456789", emailVisible, active);
}

function assign(id: string, person: string, position: string, enabled = 1) {
  db.prepare("INSERT INTO organization_assignments (id, personnel_id, position_id, enabled) VALUES (?, ?, ?, ?)").run(
    id,
    person,
    position,
    enabled
  );
}

function database(): D1Database {
  return {
    prepare(sql: string) {
      let params: unknown[] = [];
      return {
        bind(...bindings: unknown[]) {
          params = bindings;
          return this;
        },
        async all<T>() {
          return { success: true, results: db.prepare(sql).all(...(params as never[])) as T[] };
        },
        async first<T>() {
          return (db.prepare(sql).get(...(params as never[])) ?? null) as T | null;
        }
      };
    }
  } as unknown as D1Database;
}

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE contents (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL,
      title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL, deleted_at TEXT NOT NULL DEFAULT '',
      publish_at TEXT NOT NULL DEFAULT '', unpublish_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE media_assets (id TEXT PRIMARY KEY);
  `);
  db.exec(migrationSql);
  env = { DB: database() } as Env;
});
afterEach(() => db.close());

describe("published organization permalink", () => {
  it("resolves a nested slug with ordered ancestors, descendants, positions and private contact redaction", async () => {
    addContent("division");
    addContent("work", "division");
    addContent("section", "work");
    addPosition("p1", "work");
    addPosition("p2", "section");
    addPerson("private");
    addPerson("public", 1);
    assign("a1", "private", "p1");
    assign("a2", "public", "p2");
    const response = await publicOrganizationDetail(env, "work");
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      unit: { slug: string };
      ancestors: Array<{ slug: string }>;
      units: Array<{ slug: string }>;
      positions: Array<{ id: string; assignments: Array<{ person: { publicEmail: string; publicPhone: string } }> }>;
      media: unknown[];
    };
    expect(payload.unit.slug).toBe("work");
    expect(payload.ancestors.map((item) => item.slug)).toEqual(["division"]);
    expect(payload.units.map((item) => item.slug)).toEqual(["work", "section"]);
    expect(payload.positions.map((item) => item.id)).toEqual(["p1", "p2"]);
    expect(payload.positions[0]?.assignments[0]?.person).toMatchObject({ publicEmail: "", publicPhone: "" });
    expect(payload.positions[1]?.assignments[0]?.person).toMatchObject({
      publicEmail: "public@example.invalid",
      publicPhone: ""
    });
    expect(JSON.stringify(payload)).not.toContain("private@example.invalid");
    expect(JSON.stringify(payload)).not.toContain("0123456789");
    expect(response.headers.get("Cache-Control")).toContain("max-age=60");
  });

  it("supports published Thai unit slugs under the same editor contract", async () => {
    addContent("งานสารบรรณ");
    const response = await publicOrganizationDetail(env, "งานสารบรรณ");
    expect(response.status).toBe(200);
    const payload = await response.json() as { unit: { slug: string } };
    expect(payload.unit.slug).toBe("งานสารบรรณ");
  });

  it("returns identical 404 for draft units, draft parents, future pages and invalid slugs", async () => {
    addContent("draft", null, "draft");
    addContent("child", "draft");
    addContent("future", null, "published", "2099-01-01T00:00:00.000Z");
    for (const slug of ["draft", "child", "future", "missing", "../draft", ""] as const) {
      const response = await publicOrganizationDetail(env, slug);
      expect(response.status).toBe(404);
      expect((await response.json()) as unknown).not.toMatchObject({ unit: expect.anything() });
    }
  });

  it("never publishes inactive personnel, disabled duties or child units hidden by their parent", async () => {
    addContent("root");
    addContent("work", "root");
    addContent("hidden", "work", "draft");
    addPosition("visible", "work");
    addPosition("hidden-pos", "hidden");
    addPerson("disabled");
    addPerson("inactive", 1, 0);
    addPerson("enabled", 0, 1);
    assign("disabled-assignment", "disabled", "visible", 0);
    assign("inactive-assignment", "inactive", "visible");
    assign("enabled-assignment", "enabled", "visible");
    assign("hidden-assignment", "enabled", "hidden-pos");
    const response = await publicOrganizationDetail(env, "root");
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      units: Array<{ slug: string }>;
      positions: Array<{ id: string; assignments: Array<{ id: string }> }>;
    };
    expect(payload.units.map((unit) => unit.slug)).toEqual(["root", "work"]);
    expect(payload.positions.map((position) => position.id)).toEqual(["visible"]);
    expect(payload.positions[0]?.assignments.map((a) => a.id)).toEqual(["enabled-assignment"]);
  });
});
