// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const authenticateCmsSessionMock = vi.hoisted(() => vi.fn());

vi.mock("../src/auth/cmsSessionService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/auth/cmsSessionService")>();
  return { ...actual, authenticateCmsSession: authenticateCmsSessionMock };
});

import m18Doc from "../../../docs/architecture/m18-admin-d1-write-batch-migration-2026-06-16.md?raw";
import contentSlugTombstoneMigration from "../migrations/0008_content_slug_tombstones.sql?raw";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_CLIENT_IP_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  CMS_USER_AGENT_HEADER
} from "../src/routes/cmsAuthInternal";
import worker from "../src/index";

type Row = Record<string, unknown>;
type TableName =
  "contents" | "documents" | "public_home_sections" | "visitor_daily_stats" | "app_admin_users" | "admin_audit_log";

const cmsProxySecret = "phase-8-test-proxy-secret-repeated-000000000000";
const cmsSessionToken = "S".repeat(43);
const cmsCsrfToken = "C".repeat(43);
const cmsActorEmail = "cms-admin@example.invalid";
const cmsHeaders = {
  "Content-Type": "application/json",
  [CMS_AUTH_PROXY_SECRET_HEADER]: cmsProxySecret,
  [CMS_SESSION_TOKEN_HEADER]: cmsSessionToken,
  [CMS_CSRF_TOKEN_HEADER]: cmsCsrfToken,
  [CMS_CLIENT_IP_HEADER]: "203.0.113.80",
  [CMS_USER_AGENT_HEADER]: "phase-8-worker-test"
};
const cmsEnvBase = {
  CMS_AUTH_PROXY_SECRET: cmsProxySecret,
  ENVIRONMENT: "preview"
};

authenticateCmsSessionMock.mockResolvedValue({
  status: "authenticated",
  identity: {
    id: "cms-admin-user",
    email: cmsActorEmail,
    name: "CMS Admin",
    username: "cms.admin",
    role: "admin",
    isRoot: false,
    sessionId: "cms-session-1",
    sessionVersion: 1,
    reauthenticatedAt: new Date().toISOString(),
    mfaVerifiedAt: new Date().toISOString()
  }
});

const contentInput = {
  id: "m18-preview-content-001",
  title: "M18 preview news",
  slug: "m18-preview-news",
  type: "news",
  status: "draft",
  owner: "preview-editor",
  summary: "Fake M18 preview news summary.",
  body: "Fake M18 preview news body.",
  category: "sample",
  tags: ["m18", "preview"],
  seoTitle: "",
  seoDescription: "",
  canonicalUrl: "",
  featured: true,
  readingMinutes: 1,
  template: "standard",
  bodyDocId: "",
  bodyDocUrl: "",
  featuredMediaId: "m18-preview-media-001",
  mediaIds: ["m18-preview-media-001"],
  updatedAt: "2026-06-16T00:00:00.000Z",
  publishAt: "2026-06-16T00:00:00.000Z"
};

const documentInput = {
  id: "m18-preview-document-001",
  title: "M18 preview document",
  description: "Fake M18 preview document summary.",
  category: "sample",
  fileUrl: "https://files.example.test/m18-preview-document.pdf",
  fileName: "m18-preview-document.pdf",
  mediaId: "m18-preview-media-001",
  publishedAt: "",
  status: "draft",
  order: 3,
  pinned: true,
  updatedAt: "2026-06-16T00:00:00.000Z"
};

function tableFromQuery(query: string): TableName | null {
  if (/\bFROM\s+app_admin_users\s+(?:AS\s+)?u\b/i.test(query)) {
    return "app_admin_users";
  }

  const match = query.match(/\b(?:FROM|INTO|UPDATE)\s+([a-z_]+)/i);
  const tableName = match?.[1] as TableName | undefined;

  return tableName &&
    [
      "contents",
      "documents",
      "public_home_sections",
      "visitor_daily_stats",
      "app_admin_users",
      "admin_audit_log"
    ].includes(tableName)
    ? tableName
    : null;
}

function parseInsertColumns(query: string) {
  const match = query.match(/INSERT\s+INTO\s+[a-z_]+\s*\(([^)]+)\)/i);

  return match ? match[1].split(",").map((value) => value.trim()) : [];
}

function parseUpdateAssignments(query: string) {
  const match = query.match(/SET\s+(.+?)\s+WHERE/i);

  return match
    ? match[1]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
}

function rowId(row: Row) {
  return String(row.id ?? row.day ?? "");
}

function createEmptyTables(): Record<TableName, Row[]> {
  return {
    contents: [],
    documents: [],
    public_home_sections: [],
    visitor_daily_stats: [],
    app_admin_users: [],
    admin_audit_log: []
  };
}

function normalizeDeleted(row: Row) {
  return String(row.deleted_at ?? "") === "";
}

function createAdminWriteMockDb(
  options: {
    failRunMessage?: string;
    failRunQuery?: RegExp;
    failRuns?: boolean;
    missingContentColumn?: string;
  } = {}
) {
  const tables = createEmptyTables();
  const calls: { query: string; bindings: unknown[] }[] = [];

  function selectRows(query: string, bindings: unknown[]) {
    const table = tableFromQuery(query);
    const rows = table ? tables[table] : [];

    if (table === "contents") {
      if (/\(slug\s*=\s*\?\s+OR\s+id\s*=\s*\?\)/i.test(query)) {
        const status = String(bindings[0] ?? "");
        const now = String(bindings[1] ?? "");
        const slug = String(bindings[2] ?? "");
        const id = String(bindings[3] ?? "");
        return rows.filter(
          (row) =>
            row.status === status &&
            normalizeDeleted(row) &&
            (String(row.publish_at ?? "") === "" || String(row.publish_at) <= now) &&
            (row.slug === slug || row.id === id)
        );
      }

      if (/slug\s*=\s*\?/i.test(query)) {
        const slug = String(bindings[0] ?? "");
        const excludedId = String(bindings[1] ?? "");
        return rows.filter((row) => row.slug === slug && row.id !== excludedId && normalizeDeleted(row));
      }

      if (/id\s*=\s*\?/i.test(query)) {
        return rows.filter((row) => row.id === bindings[0] && normalizeDeleted(row));
      }

      if (/status\s*=\s*\?/i.test(query)) {
        const status = String(bindings[0] ?? "");
        const now = String(bindings[1] ?? "");
        const typeFilter = String(bindings[2] ?? "");
        return rows
          .filter(
            (row) =>
              row.status === status &&
              normalizeDeleted(row) &&
              (String(row.publish_at ?? "") === "" || String(row.publish_at) <= now)
          )
          .filter((row) => (!/type\s*=\s*\?/i.test(query) ? row.type !== typeFilter : row.type === typeFilter));
      }

      const activeRows = rows.filter(normalizeDeleted);

      if (/COUNT\(\*\)\s+AS\s+total/i.test(query)) {
        return [{ total: activeRows.length }];
      }

      if (/COALESCE\(deleted_at,\s*''\)\s*=\s*''/i.test(query)) {
        const limit = Number(bindings.at(-2));
        const offset = Number(bindings.at(-1));

        return Number.isFinite(limit) && Number.isFinite(offset)
          ? activeRows.slice(offset, offset + limit)
          : activeRows;
      }
    }

    if (table === "documents") {
      if (/id\s*=\s*\?/i.test(query)) {
        return rows.filter((row) => row.id === bindings[0] && normalizeDeleted(row));
      }

      if (/status\s*=\s*\?/i.test(query)) {
        return rows
          .filter((row) => row.status === bindings[0] && normalizeDeleted(row))
          .sort(
            (left, right) =>
              Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)) ||
              Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0) ||
              Date.parse(String(right.published_at ?? "")) - Date.parse(String(left.published_at ?? ""))
          );
      }
    }

    if (table === "public_home_sections") {
      if (/section_key\s*=\s*\?/i.test(query)) {
        const key = String(bindings[0] ?? "");
        const excludedId = String(bindings[1] ?? "");
        return rows.filter((row) => row.section_key === key && row.id !== excludedId && normalizeDeleted(row));
      }

      if (/id\s*=\s*\?/i.test(query)) {
        return rows.filter((row) => row.id === bindings[0] && normalizeDeleted(row));
      }

      return rows.filter((row) => row.enabled === 1 && normalizeDeleted(row));
    }

    if (table === "visitor_daily_stats") {
      if (/day\s*=\s*\?/i.test(query)) {
        return rows.filter((row) => row.day === bindings[0]);
      }

      return rows;
    }

    if (table === "app_admin_users") {
      if (/email\s*=\s*\?/i.test(query)) {
        return rows.filter((row) => row.email === bindings[0]);
      }

      if (/id\s*=\s*\?/i.test(query)) {
        return rows.filter((row) => row.id === bindings[0]);
      }

      if (/role\s*=\s*\?/i.test(query) && /status\s*=\s*\?/i.test(query)) {
        return rows.filter((row) => row.role === bindings[0] && row.status === bindings[1]);
      }

      return rows;
    }

    return rows;
  }

  function upsertRow(query: string, bindings: unknown[]) {
    const table = tableFromQuery(query);

    if (!table || table === "admin_audit_log") {
      return;
    }

    const columns = parseInsertColumns(query);
    const nextRow = Object.fromEntries(columns.map((column, index) => [column, bindings[index]]));
    const id = rowId(nextRow);
    const currentIndex = tables[table].findIndex((row) => rowId(row) === id);

    if (currentIndex === -1) {
      tables[table].push(nextRow);
      appendAudit(table, nextRow, "create");
      return;
    }

    const oldRow = tables[table][currentIndex];
    tables[table][currentIndex] = {
      ...oldRow,
      ...nextRow
    };
    appendAudit(table, tables[table][currentIndex], inferUpdateAuditAction(table, oldRow, tables[table][currentIndex]));
  }

  function updateRow(query: string, bindings: unknown[]) {
    const table = tableFromQuery(query);

    if (!table || table === "admin_audit_log") {
      return;
    }

    if (
      table === "contents" &&
      /SET\s+slug\s*=\s*'__deleted__:'\s*\|\|\s*id/i.test(query) &&
      /COALESCE\(deleted_at,\s*''\)\s*<>\s*''/i.test(query) &&
      /substr\(slug,\s*1,\s*length\('__deleted__:'\)\)\s*<>\s*'__deleted__:'/i.test(query)
    ) {
      tables.contents
        .filter((row) => String(row.deleted_at ?? "") !== "" && !String(row.slug ?? "").startsWith("__deleted__:"))
        .forEach((row) => {
          row.slug = `__deleted__:${String(row.id ?? "")}`;
        });
      return;
    }

    const idColumn = table === "visitor_daily_stats" ? "day" : "id";
    const hasRevisionGuard = /\?\s+IS\s+NULL\s+OR\s+revision\s*=\s*\?/i.test(query);
    const id = String(bindings[bindings.length - (hasRevisionGuard ? 3 : 1)] ?? "");
    const row = tables[table].find((item) => String(item[idColumn] ?? "") === id);

    if (!row) {
      return;
    }

    if (hasRevisionGuard) {
      const expectedRevision = bindings[bindings.length - 2];

      if (expectedRevision !== null && Number(row.revision ?? 0) !== Number(expectedRevision)) {
        return;
      }
    }

    const oldRow = { ...row };

    let bindingIndex = 0;
    parseUpdateAssignments(query).forEach((assignment) => {
      const [rawColumn, rawValue] = assignment.split("=").map((value) => value.trim());

      if (!rawColumn) {
        return;
      }

      if (rawValue === "?") {
        row[rawColumn] = bindings[bindingIndex];
        bindingIndex += 1;
        return;
      }

      if (/revision\s*\+\s*1/i.test(rawValue ?? "")) {
        row.revision = Number(row.revision ?? 0) + 1;
      }
    });
    appendAudit(table, row, inferUpdateAuditAction(table, oldRow, row));
  }

  function deleteRow(query: string, bindings: unknown[]) {
    const table = tableFromQuery(query);

    if (table !== "visitor_daily_stats" && table !== "app_admin_users") {
      return;
    }

    const hasRevisionGuard = /\?\s+IS\s+NULL\s+OR\s+revision\s*=\s*\?/i.test(query);
    const idColumn = table === "visitor_daily_stats" ? "day" : "id";
    const id = String(bindings[0] ?? "");
    const rowIndex = tables[table].findIndex((row) => row[idColumn] === id);

    if (rowIndex === -1) {
      return;
    }

    const row = tables[table][rowIndex];
    const expectedRevision = hasRevisionGuard ? bindings[1] : null;

    if (expectedRevision !== null && Number(row.revision ?? 0) !== Number(expectedRevision)) {
      return;
    }

    tables[table].splice(rowIndex, 1);
    appendAudit(table, row, "delete");
  }

  function inferUpdateAuditAction(table: TableName, oldRow: Row, newRow: Row) {
    if (table === "contents" || table === "documents") {
      if (String(oldRow.deleted_at ?? "") === "" && String(newRow.deleted_at ?? "") !== "") {
        return "archive";
      }

      if (oldRow.status !== "published" && newRow.status === "published") {
        return "publish";
      }

      if (oldRow.status === "published" && newRow.status !== "published") {
        return "unpublish";
      }
    }

    if (
      table === "public_home_sections" &&
      String(oldRow.deleted_at ?? "") === "" &&
      String(newRow.deleted_at ?? "") !== ""
    ) {
      return "archive";
    }

    return "update";
  }

  function appendAudit(table: TableName, row: Row, action: string) {
    if (table === "admin_audit_log") {
      return;
    }

    const entityTypes: Record<Exclude<TableName, "admin_audit_log">, string> = {
      contents: "content",
      documents: "document",
      public_home_sections: "home-section",
      visitor_daily_stats: "visitor-daily-stats",
      app_admin_users: "admin-user"
    };

    tables.admin_audit_log.push({
      id: `audit-${tables.admin_audit_log.length + 1}`,
      entity_type: entityTypes[table],
      entity_id: rowId(row),
      action,
      actor: row.updated_by ?? row.created_by ?? "",
      created_at: row.updated_at ?? "",
      metadata_json: "{}"
    });
  }

  function maybeThrowMockD1Error(query: string) {
    if (
      options.missingContentColumn &&
      tableFromQuery(query) === "contents" &&
      new RegExp(`(?:^|[^a-z_])(?:contents\\.)?${options.missingContentColumn}(?:[^a-z_]|$)`, "i").test(query)
    ) {
      throw new Error(`D1_ERROR: no such column: contents.${options.missingContentColumn}`);
    }
  }

  return {
    tables,
    calls,
    db: {
      prepare(query: string) {
        const call = {
          query,
          bindings: [] as unknown[]
        };
        calls.push(call);

        return {
          bind(...values: unknown[]) {
            call.bindings.push(...values);
            return this;
          },
          async all<T>() {
            maybeThrowMockD1Error(query);
            return {
              results: selectRows(query, call.bindings) as T[],
              success: true
            };
          },
          async first<T>() {
            maybeThrowMockD1Error(query);
            return (selectRows(query, call.bindings)[0] ?? null) as T | null;
          },
          async run() {
            maybeThrowMockD1Error(query);

            if (options.failRuns || options.failRunQuery?.test(query)) {
              throw new Error(options.failRunMessage ?? "D1 failure leaked SQL SELECT stack secret");
            }

            const before = JSON.stringify(tables);

            if (/^\s*INSERT\s+/i.test(query)) {
              upsertRow(query, call.bindings);
            }

            if (/^\s*UPDATE\s+/i.test(query)) {
              updateRow(query, call.bindings);
            }

            if (/^\s*DELETE\s+/i.test(query)) {
              deleteRow(query, call.bindings);
            }

            const changed = before === JSON.stringify(tables) ? 0 : 1;

            return {
              success: true,
              meta: {
                changes: tableFromQuery(query) ? changed : 0
              }
            };
          }
        };
      },
      batch(statements: Array<{ run: () => Promise<unknown> }>) {
        return Promise.all(statements.map((statement) => statement.run()));
      }
    } as unknown as D1Database
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function makeRequest(path: string, init: RequestInit = {}) {
  return new Request(`https://preview-worker.example.test${path}`, init);
}

function makeJsonRequest(path: string, body: unknown, init: RequestInit = {}) {
  return makeRequest(path, {
    ...init,
    method: init.method ?? "POST",
    headers: {
      ...cmsHeaders,
      ...(init.headers ?? {})
    },
    body: JSON.stringify(body)
  });
}

function makeEnv(db: D1Database | undefined = createAdminWriteMockDb().db) {
  return {
    ...cmsEnvBase,
    DB: db
  };
}

type MockTables = ReturnType<typeof createAdminWriteMockDb>["tables"];

async function expectSingleAuditMutation(
  responsePromise: Promise<Response>,
  tables: MockTables,
  expectedAudit: Pick<Row, "entity_type" | "entity_id" | "action">
) {
  const beforeCount = tables.admin_audit_log.length;
  const response = await responsePromise;

  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(300);
  expect(tables.admin_audit_log).toHaveLength(beforeCount + 1);
  expect(tables.admin_audit_log.at(-1)).toMatchObject(expectedAudit);

  return response;
}

function auditActionsFor(tables: MockTables, entityType: string, entityId: string) {
  return tables.admin_audit_log
    .filter((row) => row.entity_type === entityType && row.entity_id === entityId)
    .map((row) => row.action);
}

describe("M18 admin structured write routes", () => {
  it("documents one cohesive M18 milestone without infrastructure leakage", () => {
    expect(m18Doc).toMatch(/Admin \+ D1 Write Batch Migration/i);
    expect(m18Doc).toMatch(/single milestone/i);
    expect(m18Doc).toMatch(/Apps Script media/i);
    expect(m18Doc).not.toMatch(/M18\.1|M18\.2|M18-A|M18-B/i);
    expect(m18Doc).not.toMatch(/script\.google\.com|drive\.google\.com|rcat\.ac\.th|workers\.dev|vercel\.app/i);
    expect(m18Doc).not.toMatch(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  });

  it("backfills only legacy deleted content slugs and leaves the released slug reusable", async () => {
    const { db, tables } = createAdminWriteMockDb();
    const legacyDeleted = {
      ...contentInput,
      slug: "released-legacy-slug",
      status: "published",
      deleted_at: "2026-06-20T00:00:00.000Z",
      updated_at: "2026-06-19T00:00:00.000Z",
      updated_by: "legacy-editor",
      created_at: "2026-06-01T00:00:00.000Z",
      created_by: "legacy-author",
      revision: 7
    };
    const active = {
      ...legacyDeleted,
      id: "active-content",
      slug: "active-slug",
      deleted_at: "",
      revision: 3
    };
    const alreadyTombstoned = {
      ...legacyDeleted,
      id: "already-tombstoned",
      slug: "__deleted__:already-tombstoned",
      revision: 5
    };
    tables.contents.push(legacyDeleted, active, alreadyTombstoned);
    const legacyBefore = structuredClone(legacyDeleted);
    const activeBefore = structuredClone(active);
    const tombstoneBefore = structuredClone(alreadyTombstoned);
    const statementStart = contentSlugTombstoneMigration.search(/\bUPDATE\s+contents\b/i);
    const migrationStatement = contentSlugTombstoneMigration.slice(statementStart);

    const firstRun = await db.prepare(migrationStatement).run();

    expect(firstRun.meta.changes).toBe(1);
    expect(legacyDeleted).toEqual({ ...legacyBefore, slug: "__deleted__:m18-preview-content-001" });
    expect(active).toEqual(activeBefore);
    expect(alreadyTombstoned).toEqual(tombstoneBefore);

    const replacementResponse = await worker.fetch(
      makeJsonRequest("/api/admin/content", {
        ...contentInput,
        id: "replacement-content",
        slug: legacyBefore.slug
      }),
      makeEnv(db)
    );
    const rowsBeforeSecondRun = structuredClone(tables.contents);
    const secondRun = await db.prepare(migrationStatement).run();

    expect(replacementResponse.status).toBe(201);
    expect(tables.contents.find((row) => row.id === "replacement-content")?.slug).toBe("released-legacy-slug");
    expect(secondRun.meta.changes).toBe(0);
    expect(tables.contents).toEqual(rowsBeforeSecondRun);
  });

  it("creates, updates, publishes, unpublishes, and archives content while public reads reflect only published records", async () => {
    const { db } = createAdminWriteMockDb();
    const env = makeEnv(db);
    const createResponse = await worker.fetch(makeJsonRequest("/api/admin/content", contentInput), env);
    const draftPublicResponse = await worker.fetch(makeRequest("/api/public/content"), env);
    const publishResponse = await worker.fetch(
      makeJsonRequest("/api/admin/content/m18-preview-content-001/publish", {}),
      env
    );
    const publishedPublicResponse = await worker.fetch(makeRequest("/api/public/content"), env);
    const conflictResponse = await worker.fetch(
      makeJsonRequest(
        "/api/admin/content/m18-preview-content-001",
        {
          ...contentInput,
          title: "Stale title",
          expectedRevision: 0
        },
        { method: "PATCH" }
      ),
      env
    );
    const updateResponse = await worker.fetch(
      makeJsonRequest(
        "/api/admin/content/m18-preview-content-001",
        {
          ...contentInput,
          title: "Updated M18 preview news",
          expectedRevision: 1
        },
        { method: "PATCH" }
      ),
      env
    );
    const unpublishResponse = await worker.fetch(
      makeJsonRequest("/api/admin/content/m18-preview-content-001/unpublish", {}),
      env
    );
    const unpublishedPublicResponse = await worker.fetch(makeRequest("/api/public/content"), env);
    const deleteResponse = await worker.fetch(
      makeRequest("/api/admin/content/m18-preview-content-001", {
        method: "DELETE",
        headers: cmsHeaders
      }),
      env
    );

    expect(createResponse.status).toBe(201);
    await expect(readJson(createResponse)).resolves.toMatchObject({
      item: {
        id: "m18-preview-content-001",
        status: "draft",
        revision: 0
      }
    });
    await expect(readJson(draftPublicResponse)).resolves.toMatchObject({ items: [] });
    expect(publishResponse.status).toBe(200);
    await expect(readJson(publishResponse)).resolves.toEqual({
      id: "m18-preview-content-001",
      published: true
    });
    await expect(readJson(publishedPublicResponse)).resolves.toMatchObject({
      items: [expect.objectContaining({ slug: "m18-preview-news", title: "M18 preview news" })]
    });
    expect(conflictResponse.status).toBe(409);
    expect(updateResponse.status).toBe(200);
    await expect(readJson(updateResponse)).resolves.toMatchObject({
      item: {
        title: "Updated M18 preview news",
        revision: 2
      }
    });
    expect(unpublishResponse.status).toBe(200);
    await expect(readJson(unpublishResponse)).resolves.toEqual({
      id: "m18-preview-content-001",
      published: false
    });
    await expect(readJson(unpublishedPublicResponse)).resolves.toMatchObject({ items: [] });
    expect(deleteResponse.status).toBe(200);
    await expect(readJson(deleteResponse)).resolves.toEqual({
      id: "m18-preview-content-001",
      deleted: true
    });
  });

  it("atomically tombstones a deleted content slug and lets a published replacement own the permalink", async () => {
    const { db, tables } = createAdminWriteMockDb();
    const env = makeEnv(db);

    expect((await worker.fetch(makeJsonRequest("/api/admin/content", contentInput), env)).status).toBe(201);
    expect(
      (await worker.fetch(makeJsonRequest("/api/admin/content/m18-preview-content-001/publish", {}), env)).status
    ).toBe(200);
    const beforeDelete = structuredClone(tables.contents[0]);
    const deleteResponse = await worker.fetch(
      makeRequest("/api/admin/content/m18-preview-content-001", {
        method: "DELETE",
        headers: {
          ...cmsHeaders,
          "X-RCAT-Expected-Revision": "1"
        }
      }),
      env
    );
    const deletedRow = tables.contents[0];

    expect(deleteResponse.status).toBe(200);
    await expect(readJson(deleteResponse)).resolves.toEqual({
      id: "m18-preview-content-001",
      deleted: true
    });
    expect(deletedRow).toMatchObject({
      ...beforeDelete,
      slug: "__deleted__:m18-preview-content-001",
      deleted_at: expect.any(String),
      updated_at: expect.any(String),
      updated_by: cmsActorEmail,
      revision: Number(beforeDelete.revision) + 1
    });
    expect(String(deletedRow.deleted_at)).not.toBe("");
    expect(deletedRow.updated_at).toBe(deletedRow.deleted_at);
    expect(tables.contents).toHaveLength(1);
    expect(auditActionsFor(tables, "content", "m18-preview-content-001")).toEqual(["create", "publish", "archive"]);

    const adminListResponse = await worker.fetch(
      makeRequest("/api/admin/content?page=1&pageSize=20", { headers: cmsHeaders }),
      env
    );
    const deletedPublicResponse = await worker.fetch(makeRequest("/api/public/content/m18-preview-news"), env);

    expect(adminListResponse.status).toBe(200);
    expect(adminListResponse.headers.get("Cache-Control")).toBe("no-store");
    await expect(readJson(adminListResponse)).resolves.toMatchObject({ items: [] });
    expect(deletedPublicResponse.status).toBe(404);
    await expect(readJson(deletedPublicResponse)).resolves.toEqual({
      error: "not found",
      resource: "content-detail"
    });

    const replacement = {
      ...contentInput,
      id: "m18-preview-content-replacement",
      title: "Replacement M18 preview news"
    };
    const replacementResponse = await worker.fetch(makeJsonRequest("/api/admin/content", replacement), env);

    expect(replacementResponse.status).toBe(201);
    await expect(readJson(replacementResponse)).resolves.toMatchObject({
      item: {
        id: "m18-preview-content-replacement",
        slug: "m18-preview-news",
        revision: 0
      }
    });
    expect(tables.contents).toHaveLength(2);
    expect(tables.contents.find((row) => row.id === "m18-preview-content-001")?.slug).toBe(
      "__deleted__:m18-preview-content-001"
    );
    expect(tables.contents.find((row) => row.id === "m18-preview-content-replacement")?.slug).toBe("m18-preview-news");

    expect(
      (await worker.fetch(makeJsonRequest("/api/admin/content/m18-preview-content-replacement/publish", {}), env))
        .status
    ).toBe(200);
    const replacementPublicResponse = await worker.fetch(makeRequest("/api/public/content/m18-preview-news"), env);

    expect(replacementPublicResponse.status).toBe(200);
    await expect(readJson(replacementPublicResponse)).resolves.toMatchObject({
      item: {
        id: "m18-preview-content-replacement",
        slug: "m18-preview-news",
        title: "Replacement M18 preview news",
        status: "published"
      }
    });
  });

  it("publishes draft content with a matching expected revision header", async () => {
    const { db, tables } = createAdminWriteMockDb();
    const env = makeEnv(db);

    await worker.fetch(makeJsonRequest("/api/admin/content", { ...contentInput, publishAt: "" }), env);

    const publishResponse = await worker.fetch(
      makeJsonRequest(
        "/api/admin/content/m18-preview-content-001/publish",
        {},
        {
          headers: {
            ...cmsHeaders,
            "X-RCAT-Expected-Revision": "0"
          }
        }
      ),
      env
    );

    expect(publishResponse.status).toBe(200);
    await expect(readJson(publishResponse)).resolves.toEqual({
      id: "m18-preview-content-001",
      published: true
    });
    expect(tables.contents[0]).toMatchObject({
      status: "published",
      revision: 1,
      updated_by: cmsActorEmail
    });
    expect(String(tables.contents[0]?.publish_at ?? "")).toBeTruthy();
  });

  it("publishes draft content without a frontend revision", async () => {
    const { db, tables } = createAdminWriteMockDb();
    const env = makeEnv(db);

    await worker.fetch(makeJsonRequest("/api/admin/content", contentInput), env);

    const publishResponse = await worker.fetch(
      makeJsonRequest("/api/admin/content/m18-preview-content-001/publish", {}),
      env
    );

    expect(publishResponse.status).toBe(200);
    expect(tables.contents[0]).toMatchObject({
      status: "published",
      revision: 1
    });
  });

  it("returns stale revision for content publish conflicts instead of a generic write failure", async () => {
    const { db, tables } = createAdminWriteMockDb();
    const env = makeEnv(db);

    await worker.fetch(makeJsonRequest("/api/admin/content", contentInput), env);
    tables.contents[0].revision = 7;

    const staleResponse = await worker.fetch(
      makeJsonRequest(
        "/api/admin/content/m18-preview-content-001/publish",
        {},
        {
          headers: {
            ...cmsHeaders,
            "X-RCAT-Expected-Revision": "0"
          }
        }
      ),
      env
    );

    expect(staleResponse.status).toBe(409);
    await expect(readJson(staleResponse)).resolves.toMatchObject({
      error: "stale revision",
      resource: "admin-structured-data"
    });
  });

  it("returns not found when publishing deleted content", async () => {
    const { db } = createAdminWriteMockDb();
    const env = makeEnv(db);

    await worker.fetch(makeJsonRequest("/api/admin/content", contentInput), env);
    await worker.fetch(
      makeRequest("/api/admin/content/m18-preview-content-001", {
        method: "DELETE",
        headers: cmsHeaders
      }),
      env
    );

    const publishResponse = await worker.fetch(
      makeJsonRequest("/api/admin/content/m18-preview-content-001/publish", {}),
      env
    );

    expect(publishResponse.status).toBe(404);
    await expect(readJson(publishResponse)).resolves.toMatchObject({
      error: "not found"
    });
  });

  it.each(["deleted_at", "updated_by", "revision"])(
    "returns preview diagnostics when content publish is missing contents.%s",
    async (missingColumn) => {
      const { db, tables } = createAdminWriteMockDb({ missingContentColumn: missingColumn });
      const env = makeEnv(db);
      tables.contents.push({
        id: "m18-preview-content-001",
        slug: "m18-preview-news",
        type: "news",
        status: "draft",
        owner: "preview-editor",
        title: "M18 preview news",
        summary: "",
        body_snapshot: "",
        category: "",
        tags_json: "[]",
        seo_title: "",
        seo_description: "",
        canonical_url: "",
        featured: 0,
        reading_minutes: 1,
        template: "standard",
        body_doc_id: "",
        body_doc_url: "",
        featured_media_id: "",
        media_ids_json: "[]",
        view_count: 0,
        last_viewed_at: "",
        updated_at: "2026-06-16T00:00:00.000Z",
        publish_at: "",
        created_at: "2026-06-16T00:00:00.000Z",
        deleted_at: "",
        created_by: "preview-editor",
        updated_by: "preview-editor",
        revision: 0
      });

      const response = await worker.fetch(
        makeJsonRequest("/api/admin/content/m18-preview-content-001/publish", {}),
        env
      );
      const body = await readJson(response);

      expect(response.status).toBe(500);
      expect(body).toMatchObject({
        diagnostic: "admin-structured-schema-mismatch-v1",
        table: "contents",
        missingColumns: [missingColumn]
      });
      expect(JSON.stringify(body)).not.toMatch(/phase-8-test-proxy|SELECT|secret|token/i);
    }
  );

  it("returns preview-safe content publish diagnostics for runtime D1 failures", async () => {
    const { db } = createAdminWriteMockDb({ failRunQuery: /UPDATE\s+contents/i });
    const env = makeEnv(db);

    await worker.fetch(makeJsonRequest("/api/admin/content", contentInput), env);

    const response = await worker.fetch(
      makeJsonRequest(
        "/api/admin/content/m18-preview-content-001/publish",
        {},
        {
          headers: {
            ...cmsHeaders,
            "X-RCAT-Expected-Revision": "0"
          }
        }
      ),
      env
    );
    const body = await readJson(response);

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      diagnostic: "admin-structured-write-unhandled-v3",
      routeGroup: "content",
      operation: "publish",
      route: "content.publish",
      contentId: "m18-preview-content-001",
      expectedRevisionPresent: true,
      errorName: "Error"
    });
    expect(JSON.stringify(body)).not.toMatch(/SELECT|stack|secret|token|phase-8-test-proxy/i);
  });

  it("keeps non-preview content publish diagnostics masked for unknown D1 failures", async () => {
    const { db } = createAdminWriteMockDb({ failRunQuery: /UPDATE\s+contents/i });
    const env = {
      ...makeEnv(db),
      ENVIRONMENT: "staging"
    };

    await worker.fetch(makeJsonRequest("/api/admin/content", contentInput), env);

    const response = await worker.fetch(makeJsonRequest("/api/admin/content/m18-preview-content-001/publish", {}), env);
    const body = await readJson(response);

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "admin structured write failed",
      resource: "admin-structured-data"
    });
  });

  it("uses the custom expected-revision header for content archive conflicts", async () => {
    const { db, tables } = createAdminWriteMockDb();
    const env = makeEnv(db);

    await worker.fetch(makeJsonRequest("/api/admin/content", contentInput), env);
    const beforeStaleDelete = structuredClone(tables.contents[0]);
    const auditCountBeforeStaleDelete = tables.admin_audit_log.length;

    const staleResponse = await worker.fetch(
      makeRequest("/api/admin/content/m18-preview-content-001", {
        method: "DELETE",
        headers: {
          ...cmsHeaders,
          "X-RCAT-Expected-Revision": "9"
        }
      }),
      env
    );

    expect(staleResponse.status).toBe(409);
    await expect(readJson(staleResponse)).resolves.toEqual({
      error: "stale revision",
      resource: "admin-structured-data"
    });
    expect(tables.contents[0]).toEqual(beforeStaleDelete);
    expect(tables.admin_audit_log).toHaveLength(auditCountBeforeStaleDelete);

    const archiveResponse = await worker.fetch(
      makeRequest("/api/admin/content/m18-preview-content-001", {
        method: "DELETE",
        headers: {
          ...cmsHeaders,
          "X-RCAT-Expected-Revision": "0"
        }
      }),
      env
    );

    expect(archiveResponse.status).toBe(200);
  });

  it("removes a deleted program from the public list and public detail", async () => {
    const { db } = createAdminWriteMockDb();
    const env = makeEnv(db);
    const program = {
      ...contentInput,
      id: "field-program-001",
      slug: "field-program",
      type: "program",
      title: "Field program"
    };

    expect((await worker.fetch(makeJsonRequest("/api/admin/content", program), env)).status).toBe(201);
    expect((await worker.fetch(makeJsonRequest("/api/admin/content/field-program-001/publish", {}), env)).status).toBe(
      200
    );

    const publishedList = await worker.fetch(makeRequest("/api/public/programs"), env);
    await expect(readJson(publishedList)).resolves.toMatchObject({
      items: [expect.objectContaining({ id: "field-program-001", slug: "field-program" })]
    });

    const deleteResponse = await worker.fetch(
      makeRequest("/api/admin/content/field-program-001", {
        method: "DELETE",
        headers: { ...cmsHeaders, "X-RCAT-Expected-Revision": "1" }
      }),
      env
    );
    const deletedList = await worker.fetch(makeRequest("/api/public/programs"), env);
    const deletedDetail = await worker.fetch(makeRequest("/api/public/content/field-program"), env);

    expect(deleteResponse.status).toBe(200);
    await expect(readJson(deletedList)).resolves.toMatchObject({ items: [] });
    expect(deletedDetail.status).toBe(404);
  });

  it("records exactly one audit action for each successful structured mutation", async () => {
    const { db, tables } = createAdminWriteMockDb();
    const env = makeEnv(db);
    const homeSectionInput = {
      id: "m18-audit-home-section-001",
      key: "m18-audit-home",
      title: "M18 audit home section",
      summary: "Fake audit home section.",
      href: "https://preview.example.test/m18-audit",
      enabled: true,
      order: 1
    };
    const visitorStatsInput = {
      total: 9,
      uniqueVisitors: 4,
      onlineUsers: 1
    };

    await expectSingleAuditMutation(worker.fetch(makeJsonRequest("/api/admin/content", contentInput), env), tables, {
      entity_type: "content",
      entity_id: "m18-preview-content-001",
      action: "create"
    });
    await expectSingleAuditMutation(
      worker.fetch(
        makeJsonRequest(
          "/api/admin/content/m18-preview-content-001",
          {
            ...contentInput,
            title: "M18 audit content updated",
            expectedRevision: 0
          },
          { method: "PATCH" }
        ),
        env
      ),
      tables,
      { entity_type: "content", entity_id: "m18-preview-content-001", action: "update" }
    );
    await expectSingleAuditMutation(
      worker.fetch(makeJsonRequest("/api/admin/content/m18-preview-content-001/publish", {}), env),
      tables,
      { entity_type: "content", entity_id: "m18-preview-content-001", action: "publish" }
    );

    const beforeStaleConflict = tables.admin_audit_log.length;
    const staleConflictResponse = await worker.fetch(
      makeJsonRequest(
        "/api/admin/content/m18-preview-content-001",
        {
          ...contentInput,
          title: "M18 stale audit update",
          expectedRevision: 0
        },
        { method: "PATCH" }
      ),
      env
    );

    expect(staleConflictResponse.status).toBe(409);
    expect(tables.admin_audit_log).toHaveLength(beforeStaleConflict);

    await expectSingleAuditMutation(
      worker.fetch(makeJsonRequest("/api/admin/content/m18-preview-content-001/unpublish", {}), env),
      tables,
      { entity_type: "content", entity_id: "m18-preview-content-001", action: "unpublish" }
    );
    await expectSingleAuditMutation(
      worker.fetch(
        makeRequest("/api/admin/content/m18-preview-content-001", {
          method: "DELETE",
          headers: cmsHeaders
        }),
        env
      ),
      tables,
      { entity_type: "content", entity_id: "m18-preview-content-001", action: "archive" }
    );

    await expectSingleAuditMutation(worker.fetch(makeJsonRequest("/api/admin/documents", documentInput), env), tables, {
      entity_type: "document",
      entity_id: "m18-preview-document-001",
      action: "create"
    });
    await expectSingleAuditMutation(
      worker.fetch(
        makeJsonRequest(
          "/api/admin/documents/m18-preview-document-001",
          {
            ...documentInput,
            title: "M18 audit document updated",
            expectedRevision: 0
          },
          { method: "PATCH" }
        ),
        env
      ),
      tables,
      { entity_type: "document", entity_id: "m18-preview-document-001", action: "update" }
    );
    await expectSingleAuditMutation(
      worker.fetch(makeJsonRequest("/api/admin/documents/m18-preview-document-001/publish", {}), env),
      tables,
      { entity_type: "document", entity_id: "m18-preview-document-001", action: "publish" }
    );
    await expectSingleAuditMutation(
      worker.fetch(makeJsonRequest("/api/admin/documents/m18-preview-document-001/unpublish", {}), env),
      tables,
      { entity_type: "document", entity_id: "m18-preview-document-001", action: "unpublish" }
    );
    await expectSingleAuditMutation(
      worker.fetch(
        makeRequest("/api/admin/documents/m18-preview-document-001", {
          method: "DELETE",
          headers: cmsHeaders
        }),
        env
      ),
      tables,
      { entity_type: "document", entity_id: "m18-preview-document-001", action: "archive" }
    );

    await expectSingleAuditMutation(
      worker.fetch(makeJsonRequest("/api/admin/home-sections", homeSectionInput), env),
      tables,
      { entity_type: "home-section", entity_id: "m18-audit-home-section-001", action: "create" }
    );
    await expectSingleAuditMutation(
      worker.fetch(
        makeJsonRequest(
          "/api/admin/home-sections/m18-audit-home-section-001",
          {
            title: "M18 audit home section updated",
            expectedRevision: 0
          },
          { method: "PATCH" }
        ),
        env
      ),
      tables,
      { entity_type: "home-section", entity_id: "m18-audit-home-section-001", action: "update" }
    );
    await expectSingleAuditMutation(
      worker.fetch(
        makeRequest("/api/admin/home-sections/m18-audit-home-section-001", {
          method: "DELETE",
          headers: cmsHeaders
        }),
        env
      ),
      tables,
      { entity_type: "home-section", entity_id: "m18-audit-home-section-001", action: "archive" }
    );

    await expectSingleAuditMutation(
      worker.fetch(
        makeJsonRequest("/api/admin/visitor-stats/daily/2026-06-16", visitorStatsInput, { method: "PUT" }),
        env
      ),
      tables,
      { entity_type: "visitor-daily-stats", entity_id: "2026-06-16", action: "create" }
    );
    await expectSingleAuditMutation(
      worker.fetch(
        makeJsonRequest(
          "/api/admin/visitor-stats/daily/2026-06-16",
          {
            ...visitorStatsInput,
            total: 11
          },
          { method: "PUT" }
        ),
        env
      ),
      tables,
      { entity_type: "visitor-daily-stats", entity_id: "2026-06-16", action: "update" }
    );
    await expectSingleAuditMutation(
      worker.fetch(
        makeRequest("/api/admin/visitor-stats/daily/2026-06-16", {
          method: "DELETE",
          headers: cmsHeaders
        }),
        env
      ),
      tables,
      { entity_type: "visitor-daily-stats", entity_id: "2026-06-16", action: "delete" }
    );

    expect(auditActionsFor(tables, "content", "m18-preview-content-001")).toEqual([
      "create",
      "update",
      "publish",
      "unpublish",
      "archive"
    ]);
    expect(auditActionsFor(tables, "document", "m18-preview-document-001")).toEqual([
      "create",
      "update",
      "publish",
      "unpublish",
      "archive"
    ]);
    expect(auditActionsFor(tables, "home-section", "m18-audit-home-section-001")).toEqual([
      "create",
      "update",
      "archive"
    ]);
    expect(auditActionsFor(tables, "visitor-daily-stats", "2026-06-16")).toEqual(["create", "update", "delete"]);
  });

  it("rejects malformed JSON, missing fields, invalid statuses, and duplicate slugs safely", async () => {
    const { db } = createAdminWriteMockDb();
    const env = makeEnv(db);

    const malformedResponse = await worker.fetch(
      makeRequest("/api/admin/content", {
        method: "POST",
        headers: cmsHeaders,
        body: "{"
      }),
      env
    );
    const missingResponse = await worker.fetch(makeJsonRequest("/api/admin/content", { slug: "missing-title" }), env);
    const invalidStatusResponse = await worker.fetch(
      makeJsonRequest("/api/admin/content", {
        ...contentInput,
        id: "m18-preview-content-invalid",
        slug: "m18-preview-invalid",
        status: "hidden"
      }),
      env
    );

    await worker.fetch(makeJsonRequest("/api/admin/content", contentInput), env);
    const duplicateResponse = await worker.fetch(
      makeJsonRequest("/api/admin/content", {
        ...contentInput,
        id: "m18-preview-content-duplicate"
      }),
      env
    );

    expect(malformedResponse.status).toBe(400);
    expect(missingResponse.status).toBe(400);
    expect(invalidStatusResponse.status).toBe(400);
    expect(duplicateResponse.status).toBe(409);
    await expect(readJson(duplicateResponse)).resolves.toMatchObject({
      error: "duplicate slug",
      resource: "content",
      field: "slug"
    });
  });

  it("allows an unchanged content slug but rejects another active content slug on update", async () => {
    const { db } = createAdminWriteMockDb();
    const env = makeEnv(db);
    const secondContent = {
      ...contentInput,
      id: "m18-preview-content-002",
      slug: "m18-preview-news-2",
      title: "Second content"
    };

    await worker.fetch(makeJsonRequest("/api/admin/content", contentInput), env);
    await worker.fetch(makeJsonRequest("/api/admin/content", secondContent), env);
    const unchangedResponse = await worker.fetch(
      makeJsonRequest(
        "/api/admin/content/m18-preview-content-001",
        { ...contentInput, title: "Updated title" },
        { method: "PATCH" }
      ),
      env
    );
    const duplicateResponse = await worker.fetch(
      makeJsonRequest(
        "/api/admin/content/m18-preview-content-001",
        { ...contentInput, slug: secondContent.slug },
        { method: "PATCH" }
      ),
      env
    );

    expect(unchangedResponse.status).toBe(200);
    expect(duplicateResponse.status).toBe(409);
    await expect(readJson(duplicateResponse)).resolves.toMatchObject({ error: "duplicate slug", field: "slug" });
  });

  it("maps a physical deleted-row slug constraint to a clear conflict", async () => {
    const { db, tables } = createAdminWriteMockDb({
      failRunQuery: /^\s*INSERT\s+INTO\s+contents/i,
      failRunMessage: "D1_ERROR: UNIQUE constraint failed: contents.slug"
    });
    tables.contents.push({
      id: "deleted-content",
      slug: contentInput.slug,
      deleted_at: "2026-06-20T00:00:00.000Z"
    });

    const response = await worker.fetch(makeJsonRequest("/api/admin/content", contentInput), makeEnv(db));

    expect(response.status).toBe(409);
    await expect(readJson(response)).resolves.toMatchObject({
      error: "duplicate slug",
      resource: "content",
      field: "slug",
      detail: "A deleted content row still owns this slug at the database constraint level"
    });
  });

  it("writes document metadata, preserves deterministic public ordering, and archives without deleting media files", async () => {
    const { db } = createAdminWriteMockDb();
    const env = makeEnv(db);
    const secondDocument = {
      ...documentInput,
      id: "m18-preview-document-002",
      title: "M18 preview unpinned document",
      fileUrl: "https://files.example.test/m18-preview-unpinned.pdf",
      fileName: "m18-preview-unpinned.pdf",
      order: 1,
      pinned: false
    };

    await worker.fetch(makeJsonRequest("/api/admin/documents", secondDocument), env);
    const createResponse = await worker.fetch(makeJsonRequest("/api/admin/documents", documentInput), env);
    await worker.fetch(makeJsonRequest("/api/admin/documents/m18-preview-document-001/publish", {}), env);
    await worker.fetch(makeJsonRequest("/api/admin/documents/m18-preview-document-002/publish", {}), env);
    const publicResponse = await worker.fetch(makeRequest("/api/public/documents"), env);
    const archiveResponse = await worker.fetch(
      makeRequest("/api/admin/documents/m18-preview-document-001", {
        method: "DELETE",
        headers: cmsHeaders
      }),
      env
    );
    const afterArchiveResponse = await worker.fetch(makeRequest("/api/public/documents"), env);

    expect(createResponse.status).toBe(201);
    await expect(readJson(publicResponse)).resolves.toMatchObject({
      items: [
        expect.objectContaining({ id: "m18-preview-document-001", pinned: true }),
        expect.objectContaining({ id: "m18-preview-document-002", pinned: false })
      ]
    });
    expect(archiveResponse.status).toBe(200);
    await expect(readJson(afterArchiveResponse)).resolves.toMatchObject({
      items: [expect.objectContaining({ id: "m18-preview-document-002" })]
    });
  });

  it("writes public home sections and visitor daily stats as structured data", async () => {
    const { db, tables } = createAdminWriteMockDb();
    const env = makeEnv(db);
    const homeResponse = await worker.fetch(
      makeJsonRequest("/api/admin/home-sections", {
        id: "m18-preview-home-section-001",
        key: "m18-preview",
        title: "M18 preview section",
        summary: "Fake section only.",
        href: "https://preview.example.test/m18",
        enabled: true,
        order: 1
      }),
      env
    );
    const visitorResponse = await worker.fetch(
      makeJsonRequest(
        "/api/admin/visitor-stats/daily/2026-06-16",
        {
          total: 9,
          uniqueVisitors: 4,
          onlineUsers: 1
        },
        { method: "PUT" }
      ),
      env
    );
    const homePublicResponse = await worker.fetch(makeRequest("/api/public/home"), env);
    const visitorPublicResponse = await worker.fetch(makeRequest("/api/public/visitor-stats"), env);

    expect(homeResponse.status).toBe(201);
    expect(visitorResponse.status).toBe(200);
    const homePublicPayload = await readJson(homePublicResponse);
    expect(homePublicPayload).not.toHaveProperty("sections");
    expect(tables.public_home_sections).toEqual([
      expect.objectContaining({ id: "m18-preview-home-section-001", section_key: "m18-preview" })
    ]);
    await expect(readJson(visitorPublicResponse)).resolves.toMatchObject({
      total: 9
    });
  });

  it("returns safe errors without stack, SQL, D1 identifiers, tokens, or secrets when D1 fails", async () => {
    const { db, tables } = createAdminWriteMockDb({ failRuns: true });
    const response = await worker.fetch(makeJsonRequest("/api/admin/content", contentInput), makeEnv(db));
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toMatch(/SELECT|stack|D1 failure|secret|token|phase-8-test-proxy/i);
    expect(tables.admin_audit_log).toHaveLength(0);
  });
});
