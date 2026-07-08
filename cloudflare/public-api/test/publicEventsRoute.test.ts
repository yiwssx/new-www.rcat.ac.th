import { describe, expect, it } from "vitest";
import type { EventRow } from "../src/db/schema";
import worker from "../src/index";

const sampleRows: EventRow[] = [
  {
    id: "event-private",
    title: "Private staff meeting",
    date: "2026-05-01T09:00:00.000Z",
    end_date: "",
    audience: "staff",
    status: "confirmed",
    location: "Staff room",
    description: "Internal only",
    category: "internal",
    visibility: "private",
    updated_at: "2026-05-04T00:00:00.000Z"
  },
  {
    id: "event-public-later",
    title: "Public later event",
    date: "2026-05-20T09:00:00.000Z",
    end_date: "",
    audience: "public",
    status: "confirmed",
    location: "Main hall",
    description: "Later event",
    category: "students",
    visibility: "public",
    updated_at: "2026-05-04T00:00:00.000Z"
  },
  {
    id: "event-draft",
    title: "Draft public event",
    date: "2026-05-10T09:00:00.000Z",
    end_date: "",
    audience: "public",
    status: "draft",
    location: "Main hall",
    description: "Draft event",
    category: "students",
    visibility: "public",
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
    updated_at: "2026-05-05T00:00:00.000Z"
  },
  {
    id: "event-cancelled",
    title: "Cancelled event",
    date: "2026-05-06T09:00:00.000Z",
    end_date: "",
    audience: "public",
    status: "cancelled",
    location: "Auditorium",
    description: "Cancelled event",
    category: "admissions",
    visibility: "public",
    updated_at: "2026-05-05T00:00:00.000Z"
  }
];

function createMockDb(rows: EventRow[], options: { reject?: boolean } = {}) {
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

          const [visibility, status] = call.bindings;
          const results = rows
            .filter((row) => row.visibility === visibility && row.status === status)
            .sort(
              (left, right) => left.date.localeCompare(right.date) || right.updated_at.localeCompare(left.updated_at)
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
  it("returns only public confirmed events sorted by date ascending", async () => {
    const { env, calls } = createMockDb(sampleRows);
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/events"), env);
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(Object.keys(payload)).toEqual(["items", "generatedAt"]);
    expect(payload.items).toEqual([
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
        updatedAt: "2026-05-05T00:00:00.000Z"
      },
      {
        id: "event-public-later",
        title: "Public later event",
        date: "2026-05-20T09:00:00.000Z",
        audience: "public",
        status: "confirmed",
        location: "Main hall",
        description: "Later event",
        category: "students",
        visibility: "public",
        updatedAt: "2026-05-04T00:00:00.000Z"
      }
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/Draft|Private|Cancelled|end_date|updated_at/i);
    expect(calls[0]?.bindings).toEqual(["public", "confirmed"]);
    expect(calls[0]?.query).toMatch(/\bWHERE\s+visibility\s*=\s*\?/i);
    expect(calls[0]?.query).toMatch(/\bAND\s+status\s*=\s*\?/i);
    expect(calls[0]?.query).toMatch(/\bORDER\s+BY\s+date\s+ASC/i);
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

  it("returns a safe 500 without stack details when D1 fails", async () => {
    const { env } = createMockDb(sampleRows, { reject: true });
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

  it("returns 405 for non-GET requests through router behavior", async () => {
    const { env } = createMockDb(sampleRows);
    const response = await worker.fetch(
      new Request("https://public-api.example.test/api/public/events", { method: "POST" }),
      env
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, OPTIONS");
  });
});
