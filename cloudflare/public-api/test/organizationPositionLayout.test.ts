// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import migrationSql from "../migrations/0020_organization_content_foundation.sql?raw";
import type { Env } from "../src/env";
import type { AdminIdentity } from "../src/auth/adminAccess";
import { handleAdminOrganizationReorder } from "../src/routes/adminOrganizationReorder";
import {
  parsePositionLayout,
  saveAuditedPositionLayout,
  type PositionLayoutInput
} from "../src/routes/adminOrganizationPositionLayout";

let database: DatabaseSync;
let env: Env;

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
          const result = database.prepare(sql).run(...(values as never[]));
          return { success: true, meta: { changes: Number(result.changes) } };
        }
      };
    },
    async batch(statements: { run: () => Promise<unknown> }[]) {
      database.exec("BEGIN");
      try {
        const result = [];
        for (const statement of statements) result.push(await statement.run());
        database.exec("COMMIT");
        return result;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }
  } as unknown as D1Database;
}
function addPosition(id: string, groupLabel: string, groupOrder = 0, sortOrder = 0, unitId = "unit-1") {
  database
    .prepare(
      "INSERT INTO organization_positions (id,unit_content_id,title,group_label,group_sort_order,sort_order,updated_at) VALUES (?,?,?,?,?,?,?)"
    )
    .run(id, unitId, id, groupLabel, groupOrder, sortOrder, "2026-10-19T00:00:00.000Z");
}
function current() {
  return database
    .prepare(
      "SELECT id,unit_content_id,group_label,group_sort_order,sort_order,revision FROM organization_positions ORDER BY id"
    )
    .all() as {
    id: string;
    unit_content_id: string;
    group_label: string;
    group_sort_order: number;
    sort_order: number;
    revision: number;
  }[];
}
function countAudit() {
  return (database.prepare("SELECT COUNT(*) AS total FROM admin_audit_log").get() as { total: number }).total;
}
function layout(groups: PositionLayoutInput["groups"], scopeId = "unit-1"): PositionLayoutInput {
  return { collection: "position-layout", scopeId, groups };
}
const entry = (id: string, revision = 0) => ({ id, revision });

beforeEach(() => {
  database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(`
    CREATE TABLE contents (id TEXT PRIMARY KEY, type TEXT NOT NULL, deleted_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE media_assets (id TEXT PRIMARY KEY);
    CREATE TABLE admin_audit_log (
      id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      action TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL, metadata_json TEXT NOT NULL
    );
    INSERT INTO contents (id,type) VALUES ('unit-1','organization'),('unit-2','organization');
  `);
  database.exec(migrationSql);
  database.exec("INSERT INTO organization_units (content_id,unit_kind) VALUES ('unit-1','division'),('unit-2','work')");
  env = { DB: d1() } as Env;
});
afterEach(() => database.close());

describe("atomic grouped position layout API", () => {
  it("validates all groups, IDs, revisions, bounded full-unit payload and exact keys", () => {
    const valid = layout([
      { label: "หัวหน้า", items: [entry("p-a")] },
      { label: "", items: [entry("p-b")] }
    ]);
    expect(parsePositionLayout(valid)).toEqual(valid);
    expect(() => parsePositionLayout({ ...valid, extra: true })).toThrow();
    expect(() => parsePositionLayout({ ...valid, groups: [] })).toThrow();
    expect(() => parsePositionLayout(layout([{ label: "", items: [entry("p-a"), entry("p-a")] }]))).toThrow();
    expect(() => parsePositionLayout(layout([{ label: "", items: [entry("p-a", -1)] }]))).toThrow();
    expect(() =>
      parsePositionLayout(
        layout([
          { label: "a", items: [entry("p-a")] },
          { label: "a", items: [entry("p-b")] }
        ])
      )
    ).toThrow();
    expect(() => parsePositionLayout(layout([{ label: "x", items: [] }]))).toThrow();
    expect(() => parsePositionLayout(layout([{ label: "x", items: [entry("../id")] }]))).toThrow();
    expect(() => parsePositionLayout(layout([{ label: "x", items: [entry("p-a")] }], "../other"))).toThrow();
    expect(() =>
      parsePositionLayout(layout([{ label: "x", items: Array.from({ length: 501 }, (_, i) => entry(`p-${i}`)) }]))
    ).toThrow();
  });

  it("reorders entire groups and reassigns a sole position to another group without changing assignments", async () => {
    addPosition("a", "หัวหน้า", 0, 0);
    addPosition("b", "เจ้าหน้าที่", 1, 0);
    addPosition("c", "เจ้าหน้าที่", 1, 1);
    database.prepare("INSERT INTO personnel (id,display_name) VALUES ('staff','Staff')").run();
    database
      .prepare(
        "INSERT INTO organization_assignments (id,position_id,personnel_id,updated_at) VALUES ('assignment','a','staff','2026-10-19')"
      )
      .run();
    expect(
      await saveAuditedPositionLayout(
        env,
        layout([{ label: "เจ้าหน้าที่", items: [entry("c"), entry("b"), entry("a")] }]),
        "editor"
      )
    ).toBe(true);
    expect(current()).toEqual([
      {
        id: "a",
        unit_content_id: "unit-1",
        group_label: "เจ้าหน้าที่",
        group_sort_order: 0,
        sort_order: 2,
        revision: 1
      },
      {
        id: "b",
        unit_content_id: "unit-1",
        group_label: "เจ้าหน้าที่",
        group_sort_order: 0,
        sort_order: 1,
        revision: 1
      },
      {
        id: "c",
        unit_content_id: "unit-1",
        group_label: "เจ้าหน้าที่",
        group_sort_order: 0,
        sort_order: 0,
        revision: 1
      }
    ]);
    expect(
      database.prepare("SELECT position_id FROM organization_assignments WHERE id='assignment'").get()
    ).toMatchObject({ position_id: "a" });
    expect(countAudit()).toBe(1);
  });

  it("supports rearranging groups with a single position, including legacy duplicate group orders", async () => {
    addPosition("a", "A", 0, 0);
    addPosition("b", "B", 0, 0);
    addPosition("c", "B", 4, 1);
    expect(
      await saveAuditedPositionLayout(
        env,
        layout([
          { label: "B", items: [entry("b"), entry("c")] },
          { label: "A", items: [entry("a")] }
        ]),
        "editor"
      )
    ).toBe(true);
    expect(current().map((p) => [p.id, p.group_label, p.group_sort_order, p.sort_order])).toEqual([
      ["a", "A", 1, 0],
      ["b", "B", 0, 0],
      ["c", "B", 0, 1]
    ]);
  });

  it("routes the protected full-layout request while keeping legacy reorder validation intact", async () => {
    addPosition("a", "Group A", 0);
    addPosition("b", "Group B", 1);
    const send = async (value: unknown) => {
      const request = new Request("https://admin.example/api/admin/organization/reorder", {
        method: "POST",
        body: JSON.stringify(value),
        headers: { "Content-Type": "application/json" }
      });
      return handleAdminOrganizationReorder(
        request, env, ["organization", "reorder"], { actor: "editor" } as AdminIdentity
      );
    };
    const wrong = await send(layout([
      { label: "Moved", items: [entry("a")] }
    ]));
    expect(wrong?.status).toBe(409);
    expect(countAudit()).toBe(0);
    const invalid = await send({ collection: "position-layout", scopeId: "unit-1", groups: [] });
    expect(invalid?.status).toBe(400);
    const accepted = await send(layout([
      { label: "Group B", items: [entry("b"), entry("a")] }
    ]));
    expect(accepted?.status).toBe(200);
    expect(await accepted?.json()).toMatchObject({ reordered: true, count: 2 });
    expect(countAudit()).toBe(1);
    expect(current().map((row) => [row.id,row.group_label,row.group_sort_order,row.sort_order])).toEqual([
      ["a","Group B",0,1],["b","Group B",0,0]
    ]);
  });

  it("rejects stale or incomplete data, foreign-unit positions, without partial write or audit", async () => {
    addPosition("a", "A");
    addPosition("b", "A", 0, 1);
    addPosition("outsider", "B", 0, 0, "unit-2");
    const original = current();
    expect(await saveAuditedPositionLayout(env, layout([{ label: "A", items: [entry("a")] }]), "editor")).toBe(false);
    expect(
      await saveAuditedPositionLayout(env, layout([{ label: "A", items: [entry("a", 99), entry("b")] }]), "editor")
    ).toBe(false);
    expect(
      await saveAuditedPositionLayout(env, layout([{ label: "A", items: [entry("a"), entry("outsider")] }]), "editor")
    ).toBe(false);
    expect(current()).toEqual(original);
    expect(countAudit()).toBe(0);
  });
});
