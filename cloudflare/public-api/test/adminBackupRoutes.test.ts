// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const authenticateCmsSessionMock = vi.hoisted(() => vi.fn());

vi.mock("../src/auth/cmsSessionService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/auth/cmsSessionService")>();
  return { ...actual, authenticateCmsSession: authenticateCmsSessionMock };
});

import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_CLIENT_IP_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  CMS_USER_AGENT_HEADER
} from "../src/routes/cmsAuthInternal";
import worker from "../src/index";

const cmsProxySecret = "phase-8-backup-proxy-secret-repeated-000000000";
const cmsCsrfToken = "C".repeat(43);
const adminSessionToken = "A".repeat(43);
const editorSessionToken = "E".repeat(43);
const adminHeaders = {
  [CMS_AUTH_PROXY_SECRET_HEADER]: cmsProxySecret,
  [CMS_SESSION_TOKEN_HEADER]: adminSessionToken,
  [CMS_CSRF_TOKEN_HEADER]: cmsCsrfToken,
  [CMS_CLIENT_IP_HEADER]: "203.0.113.81",
  [CMS_USER_AGENT_HEADER]: "phase-8-backup-test"
};
const editorHeaders = {
  ...adminHeaders,
  [CMS_SESSION_TOKEN_HEADER]: editorSessionToken
};
const backupTableNames = [
  "contents",
  "media_assets",
  "documents",
  "menu_items",
  "carousel_slides",
  "external_services",
  "events",
  "site_settings",
  "homepage_settings",
  "display_settings",
  "public_home_sections",
  "visitor_daily_stats"
];

authenticateCmsSessionMock.mockImplementation(async ({ sessionToken }: { sessionToken: string }) => {
  const role = sessionToken === editorSessionToken ? "editor" : "admin";
  return {
    status: "authenticated",
    identity: {
      id: `${role}-user`,
      email: `${role}@example.test`,
      name: `${role} user`,
      username: `${role}.user`,
      role,
      isRoot: false,
      sessionId: `${role}-session`,
      sessionVersion: 1,
      reauthenticatedAt: new Date().toISOString(),
      mfaVerifiedAt: new Date().toISOString()
    }
  };
});

function makeRequest(path: string, init: RequestInit = {}) {
  return new Request(`https://preview-worker.example.test${path}`, init);
}

function createEnv(db?: D1Database) {
  return {
    CMS_AUTH_PROXY_SECRET: cmsProxySecret,
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

function createSequentialReadProbeDb() {
  let activeReads = 0;
  let maximumConcurrentReads = 0;
  const tables = Object.fromEntries(backupTableNames.map((table) => [table, [] as Array<Record<string, unknown>>]));
  tables.contents = [{ id: "content-1", revision: 2 }];

  const db = {
    prepare(query: string) {
      const tableName = tableFromQuery(query);

      return {
        bind() {
          return this;
        },
        async first<T>() {
          return { rowCount: tables[tableName]?.length ?? 0 } as T;
        },
        async all<T>() {
          activeReads += 1;
          maximumConcurrentReads = Math.max(maximumConcurrentReads, activeReads);
          await new Promise((resolve) => setTimeout(resolve, 1));
          activeReads -= 1;

          return {
            results: (tables[tableName] ?? []) as T[],
            success: true
          };
        }
      };
    }
  } as unknown as D1Database;

  return {
    db,
    getMaximumConcurrentReads: () => maximumConcurrentReads
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("M21 admin D1 backup routes", () => {
  it("rejects backup requests without an authenticated admin credential", async () => {
    const response = await worker.fetch(makeRequest("/api/admin/backup/counts"), createEnv(createBackupMockDb({})));

    expect(response.status).toBe(403);
    await expect(readJson(response)).resolves.toMatchObject({
      error: "CMS proxy authentication failed"
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

  it("reads backup tables sequentially to bound Worker export memory", async () => {
    const probe = createSequentialReadProbeDb();
    const response = await worker.fetch(
      makeRequest("/api/admin/backup/download", {
        headers: adminHeaders
      }),
      createEnv(probe.db)
    );

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toMatchObject({
      counts: {
        contents: 1
      }
    });
    expect(probe.getMaximumConcurrentReads()).toBe(1);
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
