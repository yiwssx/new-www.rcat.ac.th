import { describe, expect, it } from "vitest";
import type { DocumentRow } from "../src/db/schema";
import worker from "../src/index";

const sampleRows: DocumentRow[] = [
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
  },
  {
    id: "sample-public-document-002",
    title: "Sample meeting notice",
    description: "Second fake row to prove ordering is preserved.",
    category: "sample",
    file_url: "https://files.example.test/rcat/sample-meeting-notice.pdf",
    file_name: "sample-meeting-notice.pdf",
    media_id: "",
    published_at: "2026-01-02T00:00:00.000Z",
    status: "published",
    sort_order: 20,
    pinned: 0,
    updated_at: "2026-01-04T00:00:00.000Z"
  }
];

function createMockDb(rows: DocumentRow[], options: { reject?: boolean } = {}) {
  const calls: { query: string; bindings: unknown[] }[] = [];

  const db = {
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
          if (options.reject) {
            throw new Error("D1 exploded with internal details");
          }

          return {
            results: rows as T[],
            success: true
          };
        }
      };
    }
  };

  return {
    calls,
    env: {
      DB: db as unknown as D1Database
    }
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("M3 public documents route", () => {
  it("returns the existing public-document-list snapshot contract from D1 rows", async () => {
    const { env } = createMockDb(sampleRows);
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), env);
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(Object.keys(payload)).toEqual(["items", "generatedAt"]);
    expect(new Date(String(payload.generatedAt)).toISOString()).toBe(payload.generatedAt);
    expect(payload.items).toEqual([
      {
        id: "sample-public-document-001",
        title: "Sample public handbook",
        description: "Fake local-only public document row.",
        category: "sample",
        fileUrl: "https://files.example.test/rcat/sample-public-handbook.pdf",
        fileName: "sample-public-handbook.pdf",
        mediaId: "sample-media-001",
        publishedAt: "2026-01-01T00:00:00.000Z",
        order: 10,
        pinned: true,
        updatedAt: "2026-01-03T00:00:00.000Z"
      },
      {
        id: "sample-public-document-002",
        title: "Sample meeting notice",
        description: "Second fake row to prove ordering is preserved.",
        category: "sample",
        fileUrl: "https://files.example.test/rcat/sample-meeting-notice.pdf",
        fileName: "sample-meeting-notice.pdf",
        mediaId: "",
        publishedAt: "2026-01-02T00:00:00.000Z",
        order: 20,
        pinned: false,
        updatedAt: "2026-01-04T00:00:00.000Z"
      }
    ]);
  });

  it("returns a valid empty snapshot when D1 has no published rows", async () => {
    const { env } = createMockDb([]);
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), env);

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toMatchObject({
      items: []
    });
  });

  it("returns 503 instead of fake fallback data when DB binding is missing", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), {});

    expect(response.status).toBe(503);
    await expect(readJson(response)).resolves.toEqual({
      error: "D1 DB binding is not configured",
      resource: "public-document-list",
      phase: "M3"
    });
  });

  it("returns a safe 500 without stack details when D1 fails", async () => {
    const { env } = createMockDb(sampleRows, { reject: true });
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), env);
    const payload = await readJson(response);

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: "Unable to load public-document-list",
      resource: "public-document-list",
      phase: "M3"
    });
    expect(JSON.stringify(payload)).not.toMatch(/D1 exploded|stack|internal details/i);
  });

  it("does not expose D1 row shape or seed metadata", async () => {
    const { env } = createMockDb(sampleRows);
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), env);
    const payloadText = JSON.stringify(await readJson(response));

    expect(payloadText).not.toMatch(/sampleOnly|file_url|file_name|media_id|published_at|sort_order|updated_at/i);
    expect(payloadText).not.toMatch(/rcat\.ac\.th|script\.google\.com|drive\.google\.com/i);
    expect(payloadText).toContain("files.example.test");
  });

  it("preserves repository result order and delegates draft filtering to SQL", async () => {
    const { env, calls } = createMockDb(sampleRows);

    await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), env);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.bindings).toEqual(["published"]);
    expect(calls[0]?.query).toMatch(/\bWHERE\s+status\s*=\s*\?/i);
  });
});
