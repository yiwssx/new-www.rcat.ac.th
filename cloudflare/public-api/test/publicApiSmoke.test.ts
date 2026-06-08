import { describe, expect, it } from "vitest";
import type { DocumentRow } from "../src/db/schema";
import worker from "../src/index";

const localEnv = {};
const documentRows: DocumentRow[] = [
  {
    id: "sample-public-document-001",
    title: "Sample public handbook",
    description: "Fake local-only public document row.",
    category: "sample",
    file_url: "https://files.example.test/rcat/sample-public-handbook.pdf",
    file_name: "sample-public-handbook.pdf",
    media_id: "sample-media-001",
    published_at: "2026-01-01T00:00:00.000Z",
    status: "published",
    sort_order: 10,
    pinned: 1,
    updated_at: "2026-01-03T00:00:00.000Z"
  }
];

async function getJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function createMockDb(rows: DocumentRow[]) {
  return {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all<T>() {
          return {
            results: rows as T[],
            success: true
          };
        }
      };
    }
  } as unknown as D1Database;
}

describe("rcat public API Worker", () => {
  it("returns the M1 service health payload from /health", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/health"), localEnv);
    const payload = await getJson(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      service: "rcat-public-api",
      version: "m1-skeleton"
    });
    expect(new Date(String(payload.timestamp)).toISOString()).toBe(payload.timestamp);
  });

  it("returns the M1 service health payload from /api/health", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/api/health"), localEnv);
    const payload = await getJson(response);

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
  });

  it("returns the M3 public documents snapshot when DB is configured", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), {
      DB: createMockDb(documentRows)
    });
    const payload = await getJson(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      items: [
        {
          id: "sample-public-document-001",
          title: "Sample public handbook",
          fileUrl: "https://files.example.test/rcat/sample-public-handbook.pdf",
          fileName: "sample-public-handbook.pdf",
          mediaId: "sample-media-001",
          publishedAt: "2026-01-01T00:00:00.000Z",
          order: 10,
          pinned: true,
          updatedAt: "2026-01-03T00:00:00.000Z"
        }
      ]
    });
    expect(new Date(String(payload.generatedAt)).toISOString()).toBe(payload.generatedAt);
  });

  it("returns 503 for public documents when DB is missing", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), localEnv);

    expect(response.status).toBe(503);
    await expect(getJson(response)).resolves.toEqual({
      error: "D1 DB binding is not configured",
      resource: "public-document-list",
      phase: "M3"
    });
  });

  it("returns GET-only CORS headers for OPTIONS requests", async () => {
    const response = await worker.fetch(
      new Request("https://public-api.example.test/api/public/documents", {
        method: "OPTIONS"
      }),
      localEnv
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
  });

  it("echoes a configured allowed origin and varies the response by origin", async () => {
    const response = await worker.fetch(
      new Request("https://public-api.example.test/health", {
        headers: {
          Origin: "https://www.rcat.ac.th"
        }
      }),
      {
        PUBLIC_API_ALLOWED_ORIGINS: "https://preview.rcat.ac.th, https://www.rcat.ac.th"
      }
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://www.rcat.ac.th");
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("does not add a wildcard fallback for an untrusted configured origin", async () => {
    const response = await worker.fetch(
      new Request("https://public-api.example.test/health", {
        headers: {
          Origin: "https://untrusted.example.test"
        }
      }),
      {
        PUBLIC_API_ALLOWED_ORIGINS: "https://www.rcat.ac.th"
      }
    );

    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("returns 404 for an unknown route", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/missing"), localEnv);

    expect(response.status).toBe(404);
  });

  it("returns 405 for unsupported methods", async () => {
    const response = await worker.fetch(
      new Request("https://public-api.example.test/api/public/documents", {
        method: "POST"
      }),
      localEnv
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, OPTIONS");
  });
});
