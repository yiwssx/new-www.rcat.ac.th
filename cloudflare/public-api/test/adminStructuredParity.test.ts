// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createPublicMetadata } from "../src/adapters/publicMetadataAdapter";
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
  "X-RCAT-Admin-Smoke-Token": smokeToken,
  "X-RCAT-Admin-Proxy-Email": "m19-preview-smoke@system.invalid",
  "X-RCAT-Admin-Proxy-Role": "admin"
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

function createStructuredMockDb(
  options: { failRunTable?: string; missingSchemaColumn?: { table: string; column: string } } = {}
) {
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

          if (
            options.missingSchemaColumn?.table === table &&
            new RegExp(`^\\s*SELECT\\s+${options.missingSchemaColumn.column}\\s+FROM`, "i").test(query)
          ) {
            throw new Error(`D1_ERROR: no such column: ${table}.${options.missingSchemaColumn.column}`);
          }

          const rows = tables[table] ?? [];
          const selectedRows = /WHERE\s+id\s*=\s*\?/i.test(query)
            ? rows.filter((row) => row.id === bindings[0])
            : [...rows];

          if (/ORDER\s+BY\s+sort_order\s+ASC/i.test(query)) {
            selectedRows.sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0));
          }

          return {
            results: selectedRows as T[],
            success: true
          };
        },
        async first<T>() {
          const table = tableFromQuery(query);
          return ((tables[table] ?? [])[0] ?? null) as T | null;
        },
        async run() {
          const table = tableFromQuery(query);

          if (options.failRunTable === table) {
            throw new Error("D1 failure leaked SELECT stack secret fileBase64 appsScriptBridgeToken");
          }

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
        imageUrl: "https://images.example.test/slide.jpg",
        enabled: true,
        order: 1,
        imageFit: "fill",
        focalPointX: 35.5,
        focalPointY: 20,
        mobileImageUrl: " https://images.example.test/mobile.jpg ",
        backgroundColor: "#123456",
        openInNewTab: true
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
    expect(await readJson(carouselResponse.clone())).toMatchObject({
      item: {
        imageFit: "fill",
        focalPointX: 35.5,
        focalPointY: 20,
        mobileImageUrl: "https://images.example.test/mobile.jpg",
        backgroundColor: "#123456",
        openInNewTab: true
      }
    });
    expect(serviceResponse.status).toBe(201);
    expect(eventResponse.status).toBe(201);
    const carouselUpdateResponse = await worker.fetch(
      new Request("https://preview-worker.example.test/api/admin/carousel/slide-1", {
        method: "PATCH",
        headers: { ...smokeHeaders, "X-RCAT-Expected-Revision": "0" },
        body: JSON.stringify({
          title: "Updated slide",
          imageUrl: "https://images.example.test/slide.jpg",
          enabled: true,
          order: 1,
          imageFit: "bad-fit",
          focalPointX: -10,
          focalPointY: 140,
          backgroundColor: "expression(alert(1))",
          openInNewTab: "true"
        })
      }),
      env
    );
    expect(carouselUpdateResponse.status).toBe(200);
    expect(await readJson(carouselUpdateResponse)).toMatchObject({
      item: {
        id: "slide-1",
        title: "Updated slide",
        revision: 1,
        imageFit: "fit-blur",
        focalPointX: 0,
        focalPointY: 100,
        backgroundColor: "",
        openInNewTab: false
      }
    });
    const carouselUpdateWithoutRevisionResponse = await worker.fetch(
      request("/api/admin/carousel/slide-1", "PATCH", {
        title: "",
        imageUrl: "https://images.example.test/slide.jpg",
        enabled: true,
        order: 1
      }),
      env
    );
    expect(carouselUpdateWithoutRevisionResponse.status).toBe(200);
    expect(await readJson(carouselUpdateWithoutRevisionResponse)).toMatchObject({
      item: { id: "slide-1", title: "", revision: 2 }
    });
    expect(snapshotResponse.status).toBe(200);
    expect(snapshot).toMatchObject({
      siteSettings: { siteName: "Sample school" },
      menu: [expect.objectContaining({ id: "menu-1" })],
      carouselSlides: [expect.objectContaining({ id: "slide-1", imageFit: "fill", openInNewTab: true })],
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

  it("creates and updates event media attachments without losing ids", async () => {
    const { db, tables } = createStructuredMockDb();

    const env = {
      ...smokeEnvBase,
      DB: db
    };

    const createResponse = await worker.fetch(
      request("/api/admin/events", "POST", {
        id: "event-media",
        title: "Event with media",
        date: "2026-07-20T09:00:00.000Z",
        endDate: "2026-07-20T11:00:00.000Z",
        audience: "students",
        status: "confirmed",
        location: "Main hall",
        description: "Event description",
        category: "academic",
        visibility: "public",
        mediaIds: ["media-1", "media-2", "media-1", ""]
      }),
      env
    );

    expect(createResponse.status).toBe(201);

    expect(await readJson(createResponse)).toMatchObject({
      item: {
        id: "event-media",
        mediaIds: ["media-1", "media-2"],
        revision: 0
      }
    });

    expect(tables.events[0]?.media_ids_json).toBe('["media-1","media-2"]');

    const updateResponse = await worker.fetch(
      new Request("https://preview-worker.example.test/api/admin/events/event-media", {
        method: "PATCH",
        headers: {
          ...smokeHeaders,
          "X-RCAT-Expected-Revision": "0"
        },
        body: JSON.stringify({
          title: "Updated event with media",
          date: "2026-07-20T09:00:00.000Z",
          endDate: "2026-07-20T12:00:00.000Z",
          audience: "students",
          status: "confirmed",
          location: "Main hall",
          description: "Updated description",
          category: "academic",
          visibility: "public",
          mediaIds: ["media-2", "media-3"]
        })
      }),
      env
    );

    expect(updateResponse.status).toBe(200);

    expect(await readJson(updateResponse)).toMatchObject({
      item: {
        id: "event-media",
        title: "Updated event with media",
        mediaIds: ["media-2", "media-3"],
        revision: 1
      }
    });

    expect(tables.events[0]?.media_ids_json).toBe('["media-2","media-3"]');

    const snapshotResponse = await worker.fetch(request("/api/admin/snapshot"), env);

    expect(await readJson(snapshotResponse)).toMatchObject({
      events: [
        expect.objectContaining({
          id: "event-media",
          mediaIds: ["media-2", "media-3"]
        })
      ]
    });
  });

  it("returns admin snapshot E-Service revisions without adding revisions to public metadata", async () => {
    const { db, tables } = createStructuredMockDb();
    const env = { ...smokeEnvBase, DB: db };

    const saveResponse = await worker.fetch(
      request("/api/admin/external-services", "POST", {
        id: "service-1",
        title: "Student portal",
        href: "https://service.example.test/student",
        enabled: true,
        order: 1
      }),
      env
    );
    const snapshotResponse = await worker.fetch(request("/api/admin/snapshot"), env);
    const snapshot = await readJson(snapshotResponse);
    const publicMetadata = createPublicMetadata({
      siteSettings: null,
      homepageSettings: null,
      displaySettings: null,
      menu: [],
      media: [],
      carouselSlides: [],
      externalServices: tables.external_services as never[],
      events: []
    });

    expect(saveResponse.status).toBe(201);
    expect(snapshotResponse.status).toBe(200);
    expect(snapshot.externalServices).toEqual([expect.objectContaining({ id: "service-1", revision: 0 })]);
    expect(publicMetadata.externalServices[0]).not.toHaveProperty("revision");
  });

  it("batch saves flat E-Service links with sequential order, preserved ids, new ids, and omitted deletes", async () => {
    const { db, tables } = createStructuredMockDb();
    const env = { ...smokeEnvBase, DB: db };

    await worker.fetch(
      request("/api/admin/external-services", "POST", {
        id: "service-delete",
        title: "Delete me",
        href: "https://service.example.test/delete",
        enabled: true,
        order: 1
      }),
      env
    );
    await worker.fetch(
      request("/api/admin/external-services", "POST", {
        id: "service-keep",
        title: "Keep me",
        href: "https://service.example.test/keep",
        enabled: true,
        order: 1
      }),
      env
    );
    const existingCreatedAt = tables.external_services.find((row) => row.id === "service-keep")?.created_at;

    const response = await worker.fetch(
      request("/api/admin/external-services", "PUT", {
        items: [
          {
            id: "service-keep",
            title: "Kept and moved",
            href: "https://service.example.test/keep-updated",
            enabled: true,
            order: 99,
            revision: 0
          },
          {
            title: "New service",
            href: "https://service.example.test/new",
            enabled: false,
            order: 99
          }
        ]
      }),
      env
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.items).toEqual([
      expect.objectContaining({ id: "service-keep", title: "Kept and moved", order: 1, revision: 1 }),
      expect.objectContaining({ title: "New service", order: 2, revision: 0 })
    ]);
    expect(tables.external_services).toHaveLength(2);
    expect(tables.external_services.some((row) => row.id === "service-delete")).toBe(false);
    expect(tables.external_services.find((row) => row.id === "service-keep")).toMatchObject({
      created_at: existingCreatedAt,
      revision: 1,
      sort_order: 1
    });
    expect(tables.external_services.filter((row) => row.id === "service-keep")).toHaveLength(1);
    expect(new Set((body.items as Array<{ order: number }>).map((item) => item.order))).toEqual(new Set([1, 2]));
  });

  it("rejects nested E-Service children in the flat batch endpoint", async () => {
    const { db } = createStructuredMockDb();
    const response = await worker.fetch(
      request("/api/admin/external-services", "PUT", {
        items: [
          {
            title: "Nested service",
            href: "https://service.example.test/nested",
            children: []
          }
        ]
      }),
      { ...smokeEnvBase, DB: db }
    );

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toMatchObject({
      error: "external services must be a flat list"
    });
  });

  it("returns stale revision for batch E-Service saves when a submitted revision mismatches", async () => {
    const { db } = createStructuredMockDb();
    const env = { ...smokeEnvBase, DB: db };

    await worker.fetch(
      request("/api/admin/external-services", "POST", {
        id: "service-1",
        title: "Student portal",
        href: "https://service.example.test/student",
        enabled: true,
        order: 1
      }),
      env
    );
    const response = await worker.fetch(
      request("/api/admin/external-services", "PUT", {
        items: [
          {
            id: "service-1",
            title: "Student portal",
            href: "https://service.example.test/student",
            enabled: true,
            order: 1,
            revision: 9
          }
        ]
      }),
      env
    );

    expect(response.status).toBe(409);
    await expect(readJson(response)).resolves.toMatchObject({ error: "stale revision" });
  });

  it("keeps PATCH /api/admin/external-services/:id updating existing rows without duplicating", async () => {
    const { db, tables } = createStructuredMockDb();
    const env = { ...smokeEnvBase, DB: db };

    await worker.fetch(
      request("/api/admin/external-services", "POST", {
        id: "service-1",
        title: "Student portal",
        href: "https://service.example.test/student",
        enabled: true,
        order: 1
      }),
      env
    );
    const response = await worker.fetch(
      request("/api/admin/external-services/service-1", "PATCH", {
        title: "Updated student portal",
        href: "https://service.example.test/student-updated",
        enabled: true,
        order: 3
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({
      item: { id: "service-1", title: "Updated student portal", revision: 1 }
    });
    expect(tables.external_services.filter((row) => row.id === "service-1")).toHaveLength(1);
  });

  it("accepts optional carousel titles but requires an image URL", async () => {
    const { db } = createStructuredMockDb();
    const env = { ...smokeEnvBase, DB: db };
    const emptyTitleResponse = await worker.fetch(
      request("/api/admin/carousel", "POST", {
        title: "",
        imageUrl: "https://images.example.test/title-optional.jpg"
      }),
      env
    );
    const titledResponse = await worker.fetch(
      request("/api/admin/carousel", "POST", {
        title: "Named slide",
        imageUrl: "https://images.example.test/named.jpg"
      }),
      env
    );
    const missingImageResponse = await worker.fetch(
      request("/api/admin/carousel", "POST", { title: "Missing image" }),
      env
    );

    expect(emptyTitleResponse.status).toBe(201);
    await expect(readJson(emptyTitleResponse)).resolves.toMatchObject({ item: { title: "" } });
    expect(titledResponse.status).toBe(201);
    expect(missingImageResponse.status).toBe(400);
    await expect(readJson(missingImageResponse)).resolves.toMatchObject({
      error: "carousel image URL is required"
    });
  });

  it("returns shared preview diagnostics and schema mismatch details without sensitive values", async () => {
    const runtimeState = createStructuredMockDb({ failRunTable: "homepage_settings" });
    const runtimeResponse = await worker.fetch(request("/api/admin/settings/homepage", "PUT", { carousel: {} }), {
      ...smokeEnvBase,
      DB: runtimeState.db
    });
    const runtimeBody = await readJson(runtimeResponse);
    const schemaState = createStructuredMockDb({
      missingSchemaColumn: { table: "carousel_slides", column: "revision" }
    });
    const schemaResponse = await worker.fetch(
      request("/api/admin/carousel", "POST", {
        imageUrl: "https://images.example.test/schema.jpg"
      }),
      { ...smokeEnvBase, DB: schemaState.db }
    );

    expect(runtimeResponse.status).toBe(500);
    expect(runtimeBody).toMatchObject({
      diagnostic: "admin-structured-write-unhandled-v3",
      routeGroup: "settings",
      operation: "homepage.save",
      errorName: "Error"
    });
    expect(JSON.stringify(runtimeBody)).not.toMatch(/SELECT|stack|secret|fileBase64|appsScriptBridgeToken/i);
    expect(schemaResponse.status).toBe(500);
    await expect(readJson(schemaResponse)).resolves.toMatchObject({
      diagnostic: "admin-structured-schema-mismatch-v1",
      table: "carousel_slides",
      missingColumns: ["revision"]
    });
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
      thumbnailUrl: "https://drive.example.test/media-1/thumbnail",
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
