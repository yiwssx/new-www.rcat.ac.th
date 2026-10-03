// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";

vi.mock("../src/auth/adminAccess", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/auth/adminAccess")>()),
  authenticateAdminRequest: vi.fn(async () => ({
    identity: {
      actor: "editor@example.invalid",
      email: "editor@example.invalid",
      mode: "cms-session",
      role: "admin",
      userId: "editor",
      sessionId: "session",
      isRoot: false,
      reauthenticatedAt: new Date().toISOString(),
      mfaVerifiedAt: new Date().toISOString()
    },
    response: null
  }))
}));

import { invalidatePublicReadCacheAfterAdminMutation } from "../src/publicReadCacheInvalidation";
import { adminWrite } from "../src/routes/adminWrite";
import { handleAdminEditorialGovernance } from "../src/routes/adminEditorialGovernance";

const migrations = join(dirname(fileURLToPath(import.meta.url)), "../migrations");
let db: DatabaseSync;
let beforeUpdate: (() => void) | undefined;

function database(): D1Database {
  return {
    prepare(query: string) {
      let bindings: unknown[] = [];
      const statement = {
        bind(...values: unknown[]) {
          bindings = values;
          return statement;
        },
        async first() {
          return db.prepare(query).get(...(bindings as never[])) ?? null;
        },
        async all() {
          return { results: db.prepare(query).all(...(bindings as never[])), success: true };
        },
        async run() {
          if (/UPDATE contents\s+SET\s+slug/.test(query) && beforeUpdate) {
            const hook = beforeUpdate;
            beforeUpdate = undefined;
            hook();
          }
          const result = db.prepare(query).run(...(bindings as never[]));
          return { success: true, results: [], meta: { changes: Number(result.changes) } };
        }
      };
      return statement;
    }
  } as unknown as D1Database;
}

function env(): Env {
  return { DB: database(), ENVIRONMENT: "test" };
}

async function write(method: string, path = "", body?: Record<string, unknown>) {
  const response = await adminWrite(
    new Request(`https://worker.example.test/api/admin/content${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {})
    }),
    env()
  );
  if (!response) throw new Error("content route not matched");
  return response;
}

function create(body: Record<string, unknown> = {}) {
  return write("POST", "", {
    id: "one",
    slug: "original",
    type: "news",
    status: "draft",
    owner: "editor",
    title: "Original",
    summary: "Summary",
    body: "Content",
    ...body
  });
}

function revisions() {
  return db
    .prepare("SELECT * FROM content_revisions WHERE content_id = 'one' ORDER BY revision")
    .all()
    .map((row) => ({
      ...row,
      revision: Number(row.revision),
      reason: String(row.reason),
      actor: String(row.actor),
      created_at: String(row.created_at),
      snapshot: JSON.parse(String(row.snapshot_json)) as Record<string, unknown>
    }));
}

function row() {
  return db.prepare("SELECT * FROM contents WHERE id = 'one'").get();
}

function applyMigrations(through = "9999") {
  for (const name of readdirSync(migrations)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name) && name.slice(0, 4) <= through)
    .sort()) {
    db.exec(readFileSync(join(migrations, name), "utf8"));
  }
}

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  applyMigrations();
  beforeUpdate = undefined;
});
afterEach(() => {
  vi.unstubAllGlobals();
  db.close();
});

describe("authoritative content revision writes on migrated SQLite", () => {
  it("records creation, update, publication and unpublication with server actor and committed snapshots", async () => {
    expect((await create()).status).toBe(201);
    expect((await write("PATCH", "/one", { title: "Edited", revision: 0, updatedBy: "spoofed" })).status).toBe(200);
    expect((await write("POST", "/one/publish", {})).status).toBe(200);
    expect((await write("POST", "/one/unpublish", {})).status).toBe(200);
    const history = revisions();
    expect(history.map((item) => item.revision)).toEqual([0, 1, 2, 3]);
    expect(history.map((item) => item.reason)).toEqual(["create", "update", "publish", "unpublish"]);
    expect(history.map((item) => item.actor)).toEqual(Array(4).fill("editor@example.invalid"));
    expect(history.map((item) => item.snapshot.title)).toEqual(["Original", "Edited", "Edited", "Edited"]);
    expect(history.map((item) => item.snapshot.status)).toEqual(["draft", "draft", "published", "draft"]);
    for (const item of history) {
      expect(item.snapshot.revision).toBe(item.revision);
      expect(item.created_at).toBe(item.snapshot.updatedAt);
    }
  });

  it("preserves Worker publication time authority and future scheduling", async () => {
    const future = "2099-01-01T00:00:00.000Z";
    expect((await create({ status: "published", publishAt: future })).status).toBe(201);
    const snapshot = revisions()[0].snapshot;
    expect(snapshot.publishAt).not.toBe(future);
    expect(snapshot.publishAt).toBe(snapshot.updatedAt);
    expect((await create({ id: "scheduled", slug: "scheduled", status: "scheduled", publishAt: future })).status).toBe(
      201
    );
    const scheduled = db.prepare("SELECT snapshot_json FROM content_revisions WHERE content_id = 'scheduled'").get();
    expect(JSON.parse(String(scheduled?.snapshot_json)).publishAt).toBe(future);
  });

  it("rolls back content and audit changes if recording a revision fails", async () => {
    await create();
    const previous = row();
    const audits = db.prepare("SELECT COUNT(*) AS n FROM admin_audit_log").get();
    db.exec(`CREATE TRIGGER fail_revision BEFORE INSERT ON content_revisions WHEN NEW.revision = 1
      BEGIN SELECT RAISE(ABORT, 'injected revision failure'); END;`);
    expect((await write("PATCH", "/one", { title: "Must not persist" })).status).toBe(500);
    expect(row()).toEqual(previous);
    expect(revisions()).toHaveLength(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM admin_audit_log").get()).toEqual(audits);
  });

  it("rolls back a new content row when its initial snapshot cannot be recorded", async () => {
    db.exec(`CREATE TRIGGER fail_create BEFORE INSERT ON content_revisions
      BEGIN SELECT RAISE(ABORT, 'injected revision failure'); END;`);
    expect((await create()).status).toBe(500);
    expect(row()).toBeUndefined();
    expect(revisions()).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM admin_audit_log").get()?.n).toBe(0);
  });

  it("rejects stale edits, including a concurrent edit without a client revision", async () => {
    await create();
    beforeUpdate = () =>
      db.exec(`UPDATE contents SET title = 'Concurrent', revision = revision + 1,
      updated_at = '2026-10-03T00:00:00.000Z', updated_by = 'other' WHERE id = 'one'`);
    expect((await write("PATCH", "/one", { title: "Stale" })).status).toBe(409);
    expect(row()?.title).toBe("Concurrent");
    expect(revisions()).toHaveLength(2);
    expect((await write("PATCH", "/one", { title: "Also stale", expectedRevision: 0 })).status).toBe(409);
    expect(revisions()).toHaveLength(2);
  });

  it("rejects revision collisions rather than silently skipping required evidence", async () => {
    await create();
    db.exec(`INSERT INTO content_revisions (id, content_id, revision, reason, actor, snapshot_json, created_at)
      VALUES ('collision', 'one', 1, 'update', 'fixture', '{}', '2026-10-03')`);
    expect((await write("PATCH", "/one", { title: "Must not persist" })).status).toBe(500);
    expect(row()?.title).toBe("Original");
    expect(row()?.revision).toBe(0);
  });

  it("ignores analytics-only writes and prevents rewriting or deleting history", async () => {
    await create();
    db.exec("UPDATE contents SET view_count = view_count + 1, last_viewed_at = '2026-10-03' WHERE id = 'one'");
    expect(revisions()).toHaveLength(1);
    expect(() => db.exec("UPDATE content_revisions SET actor = 'spoofed'")).toThrow("immutable");
    expect(() => db.exec("DELETE FROM content_revisions")).toThrow("immutable");
    expect(() => db.exec("UPDATE contents SET revision = 3 WHERE id = 'one'")).toThrow("advance by one");
    expect(row()?.revision).toBe(0);
  });

  it("keeps the pre-delete slug available and restores trash as a new draft revision", async () => {
    await create();
    await write("PATCH", "/one", { slug: "renamed" });
    expect((await write("DELETE", "/one")).status).toBe(200);
    const response = await handleAdminEditorialGovernance(
      new Request("https://worker.example.test/api/admin/content/one/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      }),
      env()
    );
    expect(response?.status).toBe(200);
    expect(row()?.slug).toBe("renamed");
    expect(row()?.status).toBe("draft");
    expect(revisions().map((item) => item.reason)).toEqual(["create", "update", "delete", "restore"]);
  });

  it("invalidates both old and new slugs when the current revision is in history", async () => {
    await create();
    await write("PATCH", "/one", { slug: "renamed" });
    const removed: string[] = [];
    vi.stubGlobal("caches", {
      default: {
        delete: async (request: Request) => {
          removed.push(new URL(request.url).pathname);
          return true;
        }
      }
    });
    await invalidatePublicReadCacheAfterAdminMutation(
      new Request("https://worker.example.test/api/admin/content/one", { method: "PATCH" }),
      env(),
      new Response("{}")
    );
    expect(removed).toContain("/api/public/content/original");
    expect(removed).toContain("/api/public/content/renamed");
  });

  it("rolls back every row of a bulk publication if any snapshot fails", async () => {
    await create();
    await create({ id: "two", slug: "second" });
    db.exec(`CREATE TRIGGER fail_second BEFORE INSERT ON content_revisions
      WHEN NEW.content_id = 'two' AND NEW.revision = 1
      BEGIN SELECT RAISE(ABORT, 'injected bulk failure'); END;`);
    expect(() =>
      db.exec(`UPDATE contents SET status = 'published', revision = revision + 1,
      updated_at = '2026-10-03', updated_by = 'editor@example.invalid'`)
    ).toThrow("injected bulk failure");
    expect(db.prepare("SELECT status, revision FROM contents ORDER BY id").all()).toEqual([
      { status: "draft", revision: 0 },
      { status: "draft", revision: 0 }
    ]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM content_revisions").get()?.n).toBe(2);
  });

  it("captures a legacy pre-image without rewriting existing history", async () => {
    db.close();
    db = new DatabaseSync(":memory:");
    applyMigrations("0018");
    await create();
    expect(revisions()).toEqual([]);
    db.exec(readFileSync(join(migrations, "0019_content_revision_write_boundary.sql"), "utf8"));
    await write("PATCH", "/one", { title: "After migration" });
    expect(revisions().map((item) => item.snapshot.title)).toEqual(["Original", "After migration"]);
    const legacySnapshot = revisions()[0];
    await write("PATCH", "/one", { title: "Second update" });
    expect(revisions()[0]).toEqual(legacySnapshot);
    expect(revisions()).toHaveLength(3);
  });
});
