import { beforeEach, describe, expect, it, vi } from "vitest";

function setServerProxyEnv() {
  vi.stubEnv("VITE_BACKEND_MIGRATION_MODE", "cloudflare-first-preview");
  vi.stubEnv("VITE_ADMIN_WRITE_PROVIDER", "cloudflare");
  vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "");
  vi.stubEnv("VITE_CLOUDFLARE_ADMIN_API_URL", "");
  vi.stubEnv("VITE_CLOUDFLARE_ADMIN_AUTH_MODE", "server-proxy");
  vi.stubEnv("VITE_CLOUDFLARE_ADMIN_PROXY_URL", "/api/admin-proxy");
}

function jsonResponse(payload: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

describe("Cloudflare D1 backup admin API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    setServerProxyEnv();
  });

  it("loads backup counts through the same-origin admin proxy", async () => {
    const payload = {
      generatedAt: "2026-07-08T05:00:00.000Z",
      environment: "preview",
      tables: [
        {
          name: "contents",
          rowCount: 2,
          status: "ok"
        }
      ],
      counts: {
        contents: 2
      },
      warnings: []
    };
    const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) => jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const { getD1BackupCountsFromCloudflare } = await import("./cloudflareApi");

    await expect(getD1BackupCountsFromCloudflare()).resolves.toEqual(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin-proxy?path=%2Fapi%2Fadmin%2Fbackup%2Fcounts",
      expect.objectContaining({
        credentials: "include"
      })
    );
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("downloads the logical JSON backup and preserves the attachment filename", async () => {
    const backupJson = {
      schemaVersion: 1,
      generatedAt: "2026-07-08T05:00:00.000Z",
      environment: "preview",
      source: {
        app: "new-www.rcat.ac.th",
        backend: "cloudflare-d1"
      },
      tables: {
        contents: {
          rowCount: 1,
          rows: [{ id: "content-1", revision: 3 }]
        }
      },
      counts: {
        contents: 1
      }
    };
    const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) =>
      jsonResponse(backupJson, 200, {
        "content-disposition": 'attachment; filename="rcat-d1-backup-preview-2026-07-08T05-00-00-000Z.json"'
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { downloadD1BackupFromCloudflare } = await import("./cloudflareApi");

    const result = await downloadD1BackupFromCloudflare();

    expect(result.filename).toBe("rcat-d1-backup-preview-2026-07-08T05-00-00-000Z.json");
    expect(result.blob).toEqual(expect.objectContaining({ size: expect.any(Number) }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin-proxy?path=%2Fapi%2Fadmin%2Fbackup%2Fdownload",
      expect.objectContaining({
        credentials: "include"
      })
    );
  });
});
