// @vitest-environment node
import { describe, expect, it } from "vitest";
import m19Migration from "../migrations/0005_m19_structured_admin_parity.sql?raw";
import worker from "../src/index";

type Row = Record<string, unknown>;

const smokeToken = "m19-preview-smoke-token";
const smokeEnvBase = {
  ADMIN_WRITE_PREVIEW_ENABLED: "true",
  ADMIN_WRITE_SMOKE_ENABLED: "true",
  ADMIN_WRITE_SMOKE_TOKEN: smokeToken,
  ENVIRONMENT: "preview"
};
const smokeHeaders = {
  "Content-Type": "application/json",
  "X-RCAT-Admin-Smoke-Token": smokeToken
};

function tableFromQuery(query: string) {
  return query.match(/\b(?:FROM|INTO|UPDATE|DELETE\s+FROM)\s+([a-z_]+)/i)?.[1] ?? "";
}

function parseInsertColumns(query: string) {
  return (
    query
      .match(/INSERT\s+INTO\s+[a-z_]+\s*\(([^)]+)\)/i)?.[1]
      .split(",")
      .map((value) => value.trim()) ?? []
  );
}

function createStructuredMockDb() {
  const tables: Record<string, Row[]> = {
    contents: [],
    documents: [],
    site_settings: [],
    homepage_settings: [],
    display_settings: [],
    menu_items: [],
    media_assets: [],
    carousel_slides: [],
    external_services: [],
    events: [],
    public_home_sections: [],
    visitor_daily_stats: []
  };

  const db = {
    prepare(query: string) {
      const bindings: unknown[] = [];

      return {
        bind(...values: unknown[]) {
          bindings.push(...values);
          return this;
        },
        async all<T>() {
          const table = tableFromQuery(query);
          const rows = tables[table] ?? [];
          return {
            results: (/WHERE\s+id\s*=\s*\?/i.test(query) ? rows.filter((row) => row.id === bindings[0]) : rows) as T[],
            success: true
          };
        },
        async first<T>() {
          const table = tableFromQuery(query);
          return ((tables[table] ?? [])[0] ?? null) as T | null;
        },
        async run() {
          const table = tableFromQuery(query);

          if (/^\s*DELETE\s+FROM/i.test(query)) {
            if (/WHERE\s+id\s*=\s*\?/i.test(query)) {
              const index = (tables[table] ?? []).findIndex((row) => row.id === bindings[0]);

              if (index >= 0) {
                tables[table].splice(index, 1);
                return { success: true, meta: { changes: 1 } };
              }
            } else {
              tables[table] = [];
              return { success: true, meta: { changes: 1 } };
            }

            return { success: true, meta: { changes: 0 } };
          }

          if (/^\s*INSERT\s+INTO/i.test(query)) {
            const columns = parseInsertColumns(query);
            const row = Object.fromEntries(columns.map((column, index) => [column, bindings[index]]));
            const rows = tables[table] ?? (tables[table] = []);
            const index = rows.findIndex((item) => item.id === row.id);

            if (index >= 0) {
              rows[index] = { ...rows[index], ...row };
            } else {
              rows.push(row);
            }

            return { success: true, meta: { changes: 1 } };
          }

          if (/^\s*UPDATE/i.test(query)) {
            const assignments = query.match(/SET\s+([\s\S]+?)\s+WHERE/i)?.[1].split(",") ?? [];
            const boundAssignments = assignments.filter((assignment) => /=\s*\?/i.test(assignment));
            const id = bindings[boundAssignments.length];
            const expectedRevision = bindings[boundAssignments.length + 1];
            const row = (tables[table] ?? []).find((item) => item.id === id);

            if (!row || (expectedRevision !== undefined && row.revision !== expectedRevision)) {
              return { success: true, meta: { changes: 0 } };
            }

            boundAssignments.forEach((assignment, index) => {
              const column = assignment.match(/^\s*([a-z_]+)/i)?.[1];
              if (column) {
                row[column] = bindings[index];
              }
            });
            row.revision = Number(row.revision ?? 0) + 1;
            return { success: true, meta: { changes: 1 } };
          }

          return { success: true, meta: { changes: 0 } };
        }
      };
    },
    batch(statements: Array<{ run: () => Promise<unknown> }>) {
      return Promise.all(statements.map((statement) => statement.run()));
    }
  } as unknown as D1Database;

  return { db, tables };
}

function request(path: string, method = "GET", body?: unknown) {
  return new Request(`https://preview-worker.example.test${path}`, {
    method,
    headers: smokeHeaders,
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("M19 structured admin parity routes", () => {
  it("adds non-production-safe audit metadata and triggers for every new structured write table", () => {
    for (const table of [
      "site_settings",
      "homepage_settings",
      "display_settings",
      "menu_items",
      "carousel_slides",
      "external_services",
      "events"
    ]) {
      expect(m19Migration).toContain(`ALTER TABLE ${table} ADD COLUMN updated_by`);
      expect(m19Migration).toContain(`ALTER TABLE ${table} ADD COLUMN revision`);
      expect(m19Migration).toMatch(new RegExp(`AFTER INSERT ON ${table}`, "i"));
      expect(m19Migration).toMatch(new RegExp(`AFTER UPDATE ON ${table}`, "i"));
      expect(m19Migration).toMatch(new RegExp(`AFTER DELETE ON ${table}`, "i"));
    }

    expect(m19Migration).not.toMatch(/INSERT\s+INTO\s+(?!admin_audit_log)/i);
    expect(m19Migration).not.toMatch(/script\.google\.com|drive\.google\.com|rcat\.ac\.th/i);
  });

  it("supports settings, menu, carousel, external service, and event preview lifecycles", async () => {
    const { db } = createStructuredMockDb();
    const env = { ...smokeEnvBase, DB: db };

    const siteResponse = await worker.fetch(
      request("/api/admin/settings/site", "PUT", { siteName: "Sample school" }),
      env
    );
    const menuResponse = await worker.fetch(
      request("/api/admin/menu", "PUT", {
        items: [{ id: "menu-1", label: "Sample", href: "/sample", enabled: true }]
      }),
      env
    );
    const carouselResponse = await worker.fetch(
      request("/api/admin/carousel", "POST", {
        id: "slide-1",
        title: "Sample slide",
        enabled: true,
        order: 1
      }),
      env
    );
    const serviceResponse = await worker.fetch(
      request("/api/admin/external-services", "POST", {
        id: "service-1",
        title: "Sample service",
        href: "https://service.example.test",
        enabled: true,
        order: 1
      }),
      env
    );
    const eventResponse = await worker.fetch(
      request("/api/admin/events", "POST", {
        id: "event-1",
        title: "Sample event",
        date: "2026-06-21T00:00:00.000Z",
        audience: "public",
        status: "confirmed",
        visibility: "public"
      }),
      env
    );
    const snapshotResponse = await worker.fetch(request("/api/admin/snapshot"), env);
    const snapshot = await readJson(snapshotResponse);

    expect(siteResponse.status).toBe(200);
    expect(await readJson(siteResponse)).toMatchObject({ siteName: "Sample school" });
    expect(menuResponse.status).toBe(200);
    expect(await readJson(menuResponse)).toMatchObject({ items: [expect.objectContaining({ id: "menu-1" })] });
    expect(carouselResponse.status).toBe(201);
    expect(serviceResponse.status).toBe(201);
    expect(eventResponse.status).toBe(201);
    const carouselUpdateResponse = await worker.fetch(
      new Request("https://preview-worker.example.test/api/admin/carousel/slide-1", {
        method: "PATCH",
        headers: { ...smokeHeaders, "X-RCAT-Expected-Revision": "0" },
        body: JSON.stringify({
          title: "Updated slide",
          enabled: true,
          order: 1
        })
      }),
      env
    );
    expect(carouselUpdateResponse.status).toBe(200);
    expect(await readJson(carouselUpdateResponse)).toMatchObject({
      item: { id: "slide-1", title: "Updated slide", revision: 1 }
    });
    expect(snapshotResponse.status).toBe(200);
    expect(snapshot).toMatchObject({
      siteSettings: { siteName: "Sample school" },
      menu: [expect.objectContaining({ id: "menu-1" })],
      carouselSlides: [expect.objectContaining({ id: "slide-1" })],
      externalServices: [expect.objectContaining({ id: "service-1" })],
      events: [expect.objectContaining({ id: "event-1" })]
    });

    for (const path of [
      "/api/admin/carousel/slide-1",
      "/api/admin/external-services/service-1",
      "/api/admin/events/event-1"
    ]) {
      const deleteResponse = await worker.fetch(request(path, "DELETE"), env);
      expect(deleteResponse.status).toBe(200);
      expect(await readJson(deleteResponse)).toMatchObject({ deleted: true });
    }
  });

  it("persists only Drive-backed media metadata in D1", async () => {
    const { db, tables } = createStructuredMockDb();
    const env = { ...smokeEnvBase, DB: db };
    const media = {
      id: "media-1",
      name: "sample.pdf",
      type: "document",
      size: "12 KB",
      owner: "Sample owner",
      driveUrl: "https://drive.example.test/media-1",
      fileId: "drive-file-1",
      mimeType: "application/pdf",
      previewUrl: "https://drive.example.test/media-1/preview",
      embedUrl: "https://drive.example.test/media-1/embed",
      updatedAt: "2026-06-21T08:30:00.000Z"
    };

    const saveResponse = await worker.fetch(request("/api/admin/media", "POST", media), env);
    const snapshotResponse = await worker.fetch(request("/api/admin/snapshot"), env);

    expect(saveResponse.status).toBe(200);
    expect(await readJson(saveResponse)).toMatchObject({ item: media });
    expect(tables.media_assets).toHaveLength(1);
    expect(tables.media_assets[0]).not.toHaveProperty("bytes");
    expect(await readJson(snapshotResponse)).toMatchObject({ media: [media] });

    const deleteResponse = await worker.fetch(request("/api/admin/media/media-1", "DELETE"), env);
    expect(deleteResponse.status).toBe(200);
    expect(tables.media_assets).toHaveLength(0);
  });

  it("keeps the structured routes behind the existing preview authentication gate", async () => {
    const { db } = createStructuredMockDb();
    const response = await worker.fetch(
      new Request("https://preview-worker.example.test/api/admin/settings/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteName: "Blocked" })
      }),
      { ...smokeEnvBase, DB: db }
    );

    expect(response.status).toBe(401);
  });
});
