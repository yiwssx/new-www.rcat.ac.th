// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import initialSql from "../migrations/0001_public_read_schema.sql?raw";
import coreSql from "../migrations/0002_public_read_core_batch.sql?raw";
import adminSql from "../migrations/0003_admin_write_batch.sql?raw";
import lifecycleSql from "../migrations/0016_content_lifecycle_governance.sql?raw";
import revisionSql from "../migrations/0019_content_revision_write_boundary.sql?raw";
import organizationSql from "../migrations/0020_organization_content_foundation.sql?raw";
import {
  createAuditedOrganizationUnit,
  deleteAuditedOrganizationUnit,
  getOrganizationUnitEditor,
  updateAuditedOrganizationUnit,
  type OrganizationUnitInput
} from "../src/db/organizationUnitLifecycle";
import type { Env } from "../src/env";
import { listAdminOrganizationContentUnits } from "../src/db/organizationAdminRepository";

let db: DatabaseSync;
let env: Env;
let contentUpdateTotalChanges = 0;
let contentTombstoneTotalChanges = 0;
const NOW = "2026-10-10T04:30:00.000Z";

const input: OrganizationUnitInput = {
  slug: "division-a",
  title: "Division A",
  summary: "Test division",
  status: "draft",
  publishAt: "",
  unpublishAt: "",
  parentContentId: null,
  unitKind: "division",
  sortOrder: 0
};

function d1(): D1Database {
  return {
    prepare(sql: string) {
      let values: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          values = args;
          return this;
        },
        async run() {
          if (sql.trimStart().toUpperCase().startsWith("SELECT")) {
            return { success: true, results: db.prepare(sql).all(...(values as never[])), meta: { changes: 0 } };
          }
          // Cloudflare D1 reports sqlite3_total_changes() deltas, which include
          // trigger writes; sqlite3_changes() (StatementSync.run().changes) does not.
          const before = (db.prepare("SELECT total_changes() AS value").get() as { value: number }).value;
          db.prepare(sql).run(...(values as never[]));
          const after = (db.prepare("SELECT total_changes() AS value").get() as { value: number }).value;
          const changes = after - before;
          if (sql.trimStart().startsWith("UPDATE contents")) {
            contentUpdateTotalChanges = changes;
            if (sql.includes("deleted_at = ?")) contentTombstoneTotalChanges = changes;
          }
          return { success: true, results: [], meta: { changes } };
        },
        async first<T>() {
          return (db.prepare(sql).get(...(values as never[])) ?? null) as T | null;
        },
        async all<T>() {
          return { results: db.prepare(sql).all(...(values as never[])) as T[] };
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

function count(table: string) {
  return Number((db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count);
}

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  contentUpdateTotalChanges = 0;
  contentTombstoneTotalChanges = 0;
  db.exec("PRAGMA foreign_keys = ON;");
  for (const migration of [initialSql, coreSql, adminSql, lifecycleSql, revisionSql, organizationSql]) {
    db.exec(migration);
  }
  env = { DB: d1() };
});
afterEach(() => db.close());

describe("Organization unit + CMS content transactional lifecycle", () => {
  it("creates content, unit, immutable revision history and audit as one transaction", async () => {
    await createAuditedOrganizationUnit(env, "org1", input, "editor", NOW);
    const row = await getOrganizationUnitEditor(env, "org1");
    expect(row).toMatchObject({
      slug: "division-a",
      status: "draft",
      content_revision: 0,
      unit_revision: 0,
      unit_kind: "division"
    });
    expect(count("content_revisions")).toBe(1);
    expect(count("admin_audit_log")).toBe(1);
  });

  it("allocates consecutive root and child sibling orders without reading all units", async () => {
    await createAuditedOrganizationUnit(env, "root1", { ...input, slug: "root-one", sortOrder: 50 }, "editor", NOW, true);
    await createAuditedOrganizationUnit(env, "root2", { ...input, slug: "root-two", sortOrder: 0 }, "editor", NOW, true);
    await createAuditedOrganizationUnit(env, "child1", {
      ...input, slug: "child-one", parentContentId: "root1", sortOrder: 23
    }, "editor", NOW, true);
    await createAuditedOrganizationUnit(env, "child2", {
      ...input, slug: "child-two", parentContentId: "root1", sortOrder: 0
    }, "editor", NOW, true);
    expect((await getOrganizationUnitEditor(env, "root1"))?.sort_order).toBe(0);
    expect((await getOrganizationUnitEditor(env, "root2"))?.sort_order).toBe(1);
    expect((await getOrganizationUnitEditor(env, "child1"))?.sort_order).toBe(0);
    expect((await getOrganizationUnitEditor(env, "child2"))?.sort_order).toBe(1);
    expect(count("admin_audit_log")).toBe(4);
    expect(count("content_revisions")).toBe(4);
  });

  it("persists independent chart modes and reporting rows through audited revision writes", async () => {
    const initial = {
      ...input,
      chartMode: "rows" as const,
      chartLayout: {
        director: { level: 1, row: 1, order: 0, parentPositionId: null },
        deputy: { level: 2, row: 1, order: 1, parentPositionId: "director" }
      }
    };
    await createAuditedOrganizationUnit(env, "org1", initial, "editor", NOW);
    const created = await getOrganizationUnitEditor(env, "org1");
    expect(created?.chart_mode).toBe("rows");
    expect(JSON.parse(created?.chart_layout ?? "{}")).toEqual(initial.chartLayout);
    const next = {
      ...initial,
      chartMode: "tree" as const,
      chartLayout: { ...initial.chartLayout, deputy: { ...initial.chartLayout.deputy, row: 2 } }
    };
    expect(await updateAuditedOrganizationUnit(env, "org1", next, 0, "editor", "2026-10-10T04:31:00.000Z")).toBe(true);
    const updated = await getOrganizationUnitEditor(env, "org1");
    expect(updated).toMatchObject({ chart_mode: "tree", content_revision: 1, unit_revision: 1 });
    expect(JSON.parse(updated?.chart_layout ?? "{}")).toEqual(next.chartLayout);
    expect(await updateAuditedOrganizationUnit(env, "org1", initial, 0, "editor", "2026-10-10T04:32:00.000Z")).toBe(
      false
    );
    expect(JSON.parse((await getOrganizationUnitEditor(env, "org1"))?.chart_layout ?? "{}")).toEqual(next.chartLayout);
    expect(count("admin_audit_log")).toBe(2);
  });

  it("publishes and unpublishes with synchronized optimistic revisions", async () => {
    await createAuditedOrganizationUnit(env, "org1", input, "editor", NOW);
    const now2 = "2026-10-10T04:31:00.000Z";
    expect(
      await updateAuditedOrganizationUnit(
        env,
        "org1",
        { ...input, status: "published", publishAt: now2 },
        0,
        "editor",
        now2
      )
    ).toBe(true);
    expect(await getOrganizationUnitEditor(env, "org1")).toMatchObject({
      status: "published",
      content_revision: 1,
      unit_revision: 1
    });
    expect(count("content_revisions")).toBe(2);
    // Updating one content row ALSO inserts the immutable revision snapshot.
    // D1 reports both changes, even though exactly one CMS row was updated.
    expect(contentUpdateTotalChanges).toBeGreaterThan(1);
    expect(await updateAuditedOrganizationUnit(env, "org1", input, 0, "editor", now2)).toBe(false);
    expect(count("admin_audit_log")).toBe(2);
  });

  it("confirms a publish-to-draft save once and rejects a stale replay", async () => {
    await createAuditedOrganizationUnit(env, "org1", input, "editor", NOW);
    const publishedAt = "2026-10-12T03:31:00.000Z";
    const now2 = "2026-10-12T03:32:00.000Z";
    const published = { ...input, status: "published" as const, publishAt: publishedAt };
    expect(await updateAuditedOrganizationUnit(env, "org1", published, 0, "editor", publishedAt)).toBe(true);
    expect(await updateAuditedOrganizationUnit(env, "org1", input, 1, "editor", now2)).toBe(true);
    expect(await getOrganizationUnitEditor(env, "org1")).toMatchObject({
      status: "draft",
      content_revision: 2,
      unit_revision: 2
    });
    expect(count("admin_audit_log")).toBe(3);
    expect(count("content_revisions")).toBe(3);
    expect(await updateAuditedOrganizationUnit(env, "org1", published, 1, "editor", now2)).toBe(false);
    expect(count("admin_audit_log")).toBe(3);
  });

  it("provides a CMS-backed Admin unit list with title, slug, publication state and synchronized revisions", async () => {
    await createAuditedOrganizationUnit(env, "org1", input, "editor", NOW);
    await createAuditedOrganizationUnit(
      env,
      "org2",
      {
        ...input,
        slug: "division-b",
        title: "Division B",
        parentContentId: "org1",
        unitKind: "work"
      },
      "editor",
      NOW
    );
    const rows = await listAdminOrganizationContentUnits(env, 25);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      content_id: "org1",
      slug: "division-a",
      title: "Division A",
      status: "draft",
      unit_revision: 0,
      content_revision: 0
    });
    expect(rows[1]).toMatchObject({ parent_content_id: "org1", slug: "division-b" });
    expect(Object.keys(rows[0])).not.toContain("public_email");
    expect(await listAdminOrganizationContentUnits(env, 1)).toHaveLength(1);
    expect((await listAdminOrganizationContentUnits(env, 1, 1))[0]?.slug).toBe("division-b");
    expect(() => listAdminOrganizationContentUnits(env, 25, -1)).toThrow(/offset/);
    expect(() => listAdminOrganizationContentUnits(env, 101)).toThrow(/page size/);
  });

  it("rejects duplicate slugs and rolls back all associated unit changes", async () => {
    await createAuditedOrganizationUnit(env, "org1", input, "editor", NOW);
    await expect(createAuditedOrganizationUnit(env, "org2", input, "editor", NOW)).rejects.toThrow(/UNIQUE/);
    expect(count("organization_units")).toBe(1);
    expect(count("admin_audit_log")).toBe(1);
  });

  it("requires children and positions to be explicitly removed before deleting a unit", async () => {
    await createAuditedOrganizationUnit(env, "org1", input, "editor", NOW);
    await createAuditedOrganizationUnit(
      env,
      "org2",
      { ...input, slug: "work-b", title: "Work", parentContentId: "org1", unitKind: "work" },
      "editor",
      NOW
    );
    await expect(deleteAuditedOrganizationUnit(env, "org1", 0, "editor", NOW)).rejects.toThrow(/FOREIGN KEY/);
    expect((await getOrganizationUnitEditor(env, "org1"))?.slug).toBe("division-a");
    expect(await deleteAuditedOrganizationUnit(env, "org2", 0, "editor", NOW)).toBe(true);
    // A successful tombstone UPDATE also writes an immutable content snapshot.
    // The trigger-inclusive D1 change count is not the number of directly
    // affected rows and must not turn a committed delete into HTTP 409.
    expect(contentTombstoneTotalChanges).toBeGreaterThan(1);
    expect(await deleteAuditedOrganizationUnit(env, "org1", 0, "editor", NOW)).toBe(true);
    expect(count("organization_units")).toBe(0);
    expect(count("contents")).toBe(2);
    expect(count("content_revisions")).toBe(4);
  });

  it("prevents cyclical reparenting without changing the content revision or audit", async () => {
    await createAuditedOrganizationUnit(env, "org1", input, "editor", NOW);
    await createAuditedOrganizationUnit(
      env,
      "org2",
      { ...input, slug: "work-b", title: "Work", parentContentId: "org1", unitKind: "work" },
      "editor",
      NOW
    );
    await expect(
      updateAuditedOrganizationUnit(env, "org1", { ...input, parentContentId: "org2" }, 0, "editor", NOW)
    ).rejects.toThrow(/cycle/);
    expect((await getOrganizationUnitEditor(env, "org1"))?.content_revision).toBe(0);
    expect(count("admin_audit_log")).toBe(2);
  });
});
