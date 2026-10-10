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
          const result = db.prepare(sql).run(...(values as never[]));
          return { success: true, meta: { changes: Number(result.changes) } };
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
    expect(await updateAuditedOrganizationUnit(env, "org1", input, 0, "editor", now2)).toBe(false);
    expect(count("admin_audit_log")).toBe(2);
  });

  it("provides a CMS-backed Admin unit list with title, slug, publication state and synchronized revisions", async () => {
    await createAuditedOrganizationUnit(env, "org1", input, "editor", NOW);
    await createAuditedOrganizationUnit(env, "org2", {
      ...input, slug: "division-b", title: "Division B", parentContentId: "org1", unitKind: "work"
    }, "editor", NOW);
    const rows = await listAdminOrganizationContentUnits(env, 25);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      content_id: "org1", slug: "division-a", title: "Division A", status: "draft",
      unit_revision: 0, content_revision: 0
    });
    expect(rows[1]).toMatchObject({ parent_content_id: "org1", slug: "division-b" });
    expect(Object.keys(rows[0])).not.toContain("public_email");
    expect(await listAdminOrganizationContentUnits(env, 1)).toHaveLength(1);
    expect((await listAdminOrganizationContentUnits(env, 1, 1))[0]?.slug).toBe("division-b");
    await expect(listAdminOrganizationContentUnits(env, 25, -1)).rejects.toThrow(/offset/);
    await expect(listAdminOrganizationContentUnits(env, 101)).rejects.toThrow(/page size/);
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
