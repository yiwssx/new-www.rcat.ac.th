// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import migrationSql from "../migrations/0020_organization_content_foundation.sql?raw";
import { PUBLIC_ORGANIZATION_HIERARCHY_SQL, mapPublicOrganizationUnit } from "../src/db/organizationReadRepository";

let db: DatabaseSync;

function addContent(id: string, status: string, schedule = "", expiry = "") {
  db.prepare(
    "INSERT INTO contents (id, type, status, slug, title, summary, publish_at, unpublish_at) " +
      "VALUES (?, 'organization', ?, ?, ?, '', ?, ?)"
  ).run(id, status, id, id, schedule, expiry);
}

function addUnit(id: string, parentId: string | null = null) {
  const insert = db.prepare(
    "INSERT INTO organization_units (content_id, parent_content_id, unit_kind) VALUES (?, ?, 'work')"
  );
  insert.run(id, parentId);
}

function visibleIds() {
  const rows = db.prepare(PUBLIC_ORGANIZATION_HIERARCHY_SQL).all("2026-10-09T14:00:00.000Z");
  return rows.map((row) => row.content_id);
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
      summary TEXT NOT NULL,
      publish_at TEXT NOT NULL DEFAULT '',
      unpublish_at TEXT NOT NULL DEFAULT '',
      deleted_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE media_assets (id TEXT PRIMARY KEY);
  `);
  db.exec(migrationSql);
});

afterEach(() => {
  db.close();
});

describe("Organization Chart published hierarchy reads", () => {
  it("hides a published descendant when its parent is a draft", () => {
    addContent("root", "draft");
    addContent("child", "published");
    addUnit("root");
    addUnit("child", "root");
    expect(visibleIds()).toEqual([]);
  });

  it("includes only published ancestor chains without exposing draft descendants", () => {
    addContent("root", "published");
    addContent("child", "published");
    addContent("grandchild", "draft");
    addUnit("root");
    addUnit("child", "root");
    addUnit("grandchild", "child");
    expect(visibleIds()).toEqual(["root", "child"]);
  });

  it("publishes scheduled ancestor chains only after the scheduled timestamp", () => {
    addContent("scheduled-parent", "scheduled", "2026-10-09T13:00:00.000Z");
    addContent("scheduled-child", "scheduled", "2026-10-09T15:00:00.000Z");
    addContent("published-child", "published");
    addUnit("scheduled-parent");
    addUnit("scheduled-child", "scheduled-parent");
    addUnit("published-child", "scheduled-parent");
    expect(visibleIds()).toEqual(["scheduled-parent", "published-child"]);
  });

  it("respects scheduled publishing and expiration on every ancestor", () => {
    addContent("root", "published", "", "2026-10-09T13:00:00.000Z");
    addContent("child", "published");
    addUnit("root");
    addUnit("child", "root");
    expect(visibleIds()).toEqual([]);
  });

  it("does not expose internal row fields from its public mapping", () => {
    const result = mapPublicOrganizationUnit({
      content_id: "u1",
      parent_content_id: null,
      unit_kind: "division",
      sort_order: 0,
      slug: "division",
      title: "Division",
      summary: "",
      depth: 0
    });
    expect(result).toEqual({
      contentId: "u1",
      parentContentId: null,
      unitKind: "division",
      sortOrder: 0,
      slug: "division",
      title: "Division",
      summary: "",
      depth: 0
    });
  });
});
