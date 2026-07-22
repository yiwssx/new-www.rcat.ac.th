// @vitest-environment node
import { describe, expect, it } from "vitest";
import worker from "../src/index";

const smokeToken = "m21-preview-smoke-token";
const adminHeaders = {
  "X-RCAT-Admin-Smoke-Token": smokeToken,
  "X-RCAT-Admin-Proxy-Email": "admin@example.test",
  "X-RCAT-Admin-Proxy-Role": "admin"
};
const editorHeaders = {
  ...adminHeaders,
  "X-RCAT-Admin-Proxy-Email": "editor@example.test",
  "X-RCAT-Admin-Proxy-Role": "editor"
};

function makeRequest(path: string, init: RequestInit = {}) {
  return new Request(`https://preview-worker.example.test${path}`, init);
}

function createEnv(db?: D1Database) {
  return {
    ADMIN_WRITE_PREVIEW_ENABLED: "true",
    ADMIN_WRITE_SMOKE_ENABLED: "true",
    ADMIN_WRITE_SMOKE_TOKEN: smokeToken,
    ENVIRONMENT: "preview",
    DB: db
  };
}

function tableFromQuery(query: string) {
  return query.match(/\bFROM\s+([a-z_]+)/i)?.[1] ?? "";
}

function createBackupMockDb(tables: Record<string, Array<Record<string, unknown>>>) {
  return {
    prepare(query: string) {
      const tableName = tableFromQuery(query);

      return {
        bind() {
          return this;
        },
        async first<T>() {
          if (!(tableName in tables)) {
            throw new Error(`D1_ERROR: no such table: ${tableName}`);
          }

          return { rowCount: tables[tableName].length } as T;
        },
        async all<T>() {
          if (!(tableName in tables)) {
            throw new Error(`D1_ERROR: no such table: ${tableName}`);
          }

          return {
            results: tables[tableName] as T[],
            success: true
          };
        }
      };
    }
  } as unknown as D1Database;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("M21 admin D1 backup routes", () => {
  it("rejects backup requests without an authenticated admin credential", async () => {
    const response = await worker.fetch(makeRequest("/api/admin/backup/counts"), createEnv(createBackupMockDb({})));

    expect(response.status).toBe(401);
    await expect(readJson(response)).resolves.toMatchObject({
      error: "admin smoke credential is required"
    });
  });

  it("rejects non-admin backup requests even when the proxy session is valid", async () => {
    const response = await worker.fetch(
      makeRequest("/api/admin/backup/download", {
        headers: editorHeaders
      }),
      createEnv(createBackupMockDb({ contents: [] }))
    );

    expect(response.status).toBe(403);
    await expect(readJson(response)).resolves.toMatchObject({
      error: "required permission is missing"
    });
  });

  it("returns table counts for authorized admin users and tolerates missing optional tables", async () => {
    const response = await worker.fetch(
      makeRequest("/api/admin/backup/counts", {
        headers: adminHeaders
      }),
      createEnv(
        createBackupMockDb({
          contents: [
            {
              id: "content-1",
              revision: 2
            }
          ],
          documents: []
        })
      )
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      environment: "preview",
      counts: {
        contents: 1,
        documents: 0,
        media_assets: 0
      },
      tables: expect.arrayContaining([
        expect.objectContaining({ name: "contents", rowCount: 1, status: "ok" }),
        expect.objectContaining({ name: "media_assets", rowCount: 0, status: "missing" })
      ])
    });
    expect(payload.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/media_assets/i)]));
  });

  it("returns a downloadable logical JSON backup for authorized admin users", async () => {
    const response = await worker.fetch(
      makeRequest("/api/admin/backup/download", {
        headers: adminHeaders
      }),
      createEnv(
        createBackupMockDb({
          contents: [{ id: "content-1", revision: 2, deleted_at: "" }],
          media_assets: [],
          documents: []
        })
      )
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="rcat-d1-backup-preview-[^"]+\.json"$/
    );
    expect(payload).toMatchObject({
      schemaVersion: 1,
      environment: "preview",
      source: {
        app: "new-www.rcat.ac.th",
        backend: "cloudflare-d1"
      },
      counts: {
        contents: 1,
        media_assets: 0
      },
      tables: {
        contents: {
          rowCount: 1,
          rows: [expect.objectContaining({ id: "content-1", revision: 2 })]
        }
      }
    });
    expect(typeof payload.generatedAt).toBe("string");
  });

  it("returns a safe error when the D1 binding is missing", async () => {
    const response = await worker.fetch(
      makeRequest("/api/admin/backup/counts", {
        headers: adminHeaders
      }),
      createEnv(undefined)
    );

    expect(response.status).toBe(503);
    await expect(readJson(response)).resolves.toMatchObject({
      error: "database binding is not configured"
    });
  });
});

describe("M21 Worker security headers", () => {
  it("adds baseline security headers to normal JSON responses", async () => {
    const response = await worker.fetch(makeRequest("/api/health"), {
      PUBLIC_API_VERSION: "test"
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    );
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-site");
  });

  it("adds security headers to error responses while preserving CORS", async () => {
    const response = await worker.fetch(
      makeRequest("/api/public/documents", {
        headers: {
          Origin: "https://www.example.test"
        }
      }),
      {
        PUBLIC_API_ALLOWED_ORIGINS: "https://www.example.test"
      }
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://www.example.test");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});
