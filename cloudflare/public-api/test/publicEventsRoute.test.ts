import { describe, expect, it } from "vitest";
import type { EventRow, MediaAssetRow } from "../src/db/schema";
import worker from "../src/index";

const sampleRows: EventRow[] = [
  {
    id: "event-private",
    title: "Private staff meeting",
    date: "2026-05-01T09:00:00.000Z",
    end_date: "2026-05-01T10:00:00.000Z",
    audience: "staff",
    status: "confirmed",
    location: "Staff room",
    description: "Internal only",
    category: "internal",
    visibility: "private",
    media_ids_json: "[]",
    updated_at: "2026-05-04T00:00:00.000Z"
  },
  {
    id: "event-public-later",
    title: "Public later event",
    date: "2026-05-20T09:00:00.000Z",
    end_date: "2026-05-20T11:00:00.000Z",
    audience: "public",
    status: "confirmed",
    location: "Main hall",
    description: "Later event",
    category: "students",
    visibility: "public",
    media_ids_json: JSON.stringify(["media-image", "media-document", "media-image", ""]),
    updated_at: "2026-05-04T00:00:00.000Z"
  },
  {
    id: "event-draft",
    title: "Draft public event",
    date: "2026-05-10T09:00:00.000Z",
    end_date: "2026-05-10T11:00:00.000Z",
    audience: "public",
    status: "draft",
    location: "Main hall",
    description: "Draft event",
    category: "students",
    visibility: "public",
    media_ids_json: '["media-unreferenced"]',
    updated_at: "2026-05-04T00:00:00.000Z"
  },
  {
    id: "event-public-sooner",
    title: "Public sooner event",
    date: "2026-05-05T09:00:00.000Z",
    end_date: "2026-05-05T11:00:00.000Z",
    audience: "public",
    status: "confirmed",
    location: "Auditorium",
    description: "Sooner event",
    category: "admissions",
    visibility: "public",
    media_ids_json: "[]",
    updated_at: "2026-05-05T00:00:00.000Z"
  },
  {
    id: "event-cancelled",
    title: "Cancelled event",
    date: "2026-05-06T09:00:00.000Z",
    end_date: "2026-05-06T11:00:00.000Z",
    audience: "public",
    status: "cancelled",
    location: "Auditorium",
    description: "Cancelled event",
    category: "admissions",
    visibility: "public",
    media_ids_json: '["media-unreferenced"]',
    updated_at: "2026-05-05T00:00:00.000Z"
  }
];

const sampleMediaRows: MediaAssetRow[] = [
  {
    id: "media-image",
    name: "Event image",
    type: "image",
    size: "120 KB",
    owner: "Admin",
    drive_url: "https://files.example.test/event.jpg",
    file_id: "drive-image",
    mime_type: "image/jpeg",
    preview_url: "https://files.example.test/event.jpg",
    embed_url: "",
    thumbnail_url: "https://files.example.test/event-thumb.jpg",
    updated_at: "2026-05-06T00:00:00.000Z"
  },
  {
    id: "media-document",
    name: "Event document",
    type: "document",
    size: "240 KB",
    owner: "Admin",
    drive_url: "https://files.example.test/event.pdf",
    file_id: "drive-document",
    mime_type: "application/pdf",
    preview_url: "https://files.example.test/event.pdf",
    embed_url: "",
    thumbnail_url: "",
    updated_at: "2026-05-05T00:00:00.000Z"
  },
  {
    id: "media-unreferenced",
    name: "Unreferenced media",
    type: "image",
    size: "100 KB",
    owner: "Admin",
    drive_url: "https://files.example.test/unreferenced.jpg",
    file_id: "drive-unreferenced",
    mime_type: "image/jpeg",
    preview_url: "https://files.example.test/unreferenced.jpg",
    embed_url: "",
    thumbnail_url: "",
    updated_at: "2026-05-07T00:00:00.000Z"
  }
];

function createMockDb(
  eventRows: EventRow[],
  mediaRows: MediaAssetRow[] = sampleMediaRows,
  options: {
    reject?: boolean;
  } = {}
) {
  const calls: {
    query: string;
    bindings: unknown[];
  }[] = [];

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

          if (/\bFROM\s+media_assets\b/i.test(query)) {
            const requestedIds = new Set(call.bindings.map(String));

            const results = mediaRows
              .filter((row) => requestedIds.has(row.id))
              .sort((left, right) => right.updated_at.localeCompare(left.updated_at));

            return {
              results: results as T[],
              success: true
            };
          }

          const [visibility, status] = call.bindings;

          const results = eventRows
            .filter((row) => row.visibility === visibility && row.status === status)
            .sort(
              (left, right) => right.date.localeCompare(left.date) || right.updated_at.localeCompare(left.updated_at)
            );

          return {
            results: results as T[],
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

describe("public events route", () => {
  it("returns public confirmed events in descending date order with referenced media only", async () => {
    const { env, calls } = createMockDb(sampleRows);

    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/events"), env);

    const payload = await readJson(response);

    expect(response.status).toBe(200);

    expect(Object.keys(payload)).toEqual(["items", "media", "generatedAt"]);

    expect(payload.items).toEqual([
      {
        id: "event-public-later",
        title: "Public later event",
        date: "2026-05-20T09:00:00.000Z",
        endDate: "2026-05-20T11:00:00.000Z",
        audience: "public",
        status: "confirmed",
        location: "Main hall",
        description: "Later event",
        category: "students",
        visibility: "public",
        mediaIds: ["media-image", "media-document"],
        updatedAt: "2026-05-04T00:00:00.000Z"
      },
      {
        id: "event-public-sooner",
        title: "Public sooner event",
        date: "2026-05-05T09:00:00.000Z",
        endDate: "2026-05-05T11:00:00.000Z",
        audience: "public",
        status: "confirmed",
        location: "Auditorium",
        description: "Sooner event",
        category: "admissions",
        visibility: "public",
        mediaIds: [],
        updatedAt: "2026-05-05T00:00:00.000Z"
      }
    ]);

    expect(payload.media).toEqual([
      expect.objectContaining({
        id: "media-image",
        name: "Event image",
        type: "image"
      }),
      expect.objectContaining({
        id: "media-document",
        name: "Event document",
        type: "document"
      })
    ]);

    expect(JSON.stringify(payload)).not.toMatch(/Draft|Private|Cancelled|media_ids_json|end_date|updated_at/i);

    expect(JSON.stringify(payload)).not.toContain("media-unreferenced");

    const eventQuery = calls.find((call) => /\bFROM\s+events\b/i.test(call.query));

    const mediaQuery = calls.find((call) => /\bFROM\s+media_assets\b/i.test(call.query));

    expect(eventQuery?.bindings).toEqual(["public", "confirmed"]);

    expect(eventQuery?.query).toMatch(/\bORDER\s+BY\s+date\s+DESC/i);

    expect(mediaQuery?.query).toMatch(/\bWHERE\s+id\s+IN\s*\(/i);

    expect(new Set(mediaQuery?.bindings.map(String))).toEqual(new Set(["media-image", "media-document"]));
  });

  it("returns 503 when DB binding is missing", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/events"), {});

    expect(response.status).toBe(503);

    await expect(readJson(response)).resolves.toEqual({
      error: "D1 DB binding is not configured",
      resource: "public-events",
      phase: "M21"
    });
  });

  it("returns a safe 500 without internal D1 details", async () => {
    const { env } = createMockDb(sampleRows, sampleMediaRows, {
      reject: true
    });

    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/events"), env);

    const payload = await readJson(response);

    expect(response.status).toBe(500);

    expect(payload).toEqual({
      error: "Unable to load public-events",
      resource: "public-events",
      phase: "M21"
    });

    expect(JSON.stringify(payload)).not.toMatch(/D1 exploded|stack|internal details/i);
  });

  it("returns 405 for non-GET requests", async () => {
    const { env } = createMockDb(sampleRows);

    const response = await worker.fetch(
      new Request("https://public-api.example.test/api/public/events", {
        method: "POST"
      }),
      env
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, OPTIONS");
  });
});
