import { describe, expect, it } from "vitest";
import m17Doc from "../../../docs/architecture/m17-cloudflare-core-public-read-batch-2026-06-13.md?raw";
import type { DocumentRow } from "../src/db/schema";
import worker from "../src/index";
import { PUBLIC_READ_ROUTE_REGISTRY } from "../src/routes/publicReadRegistry";

const sampleDocuments: DocumentRow[] = [
  {
    id: "sample-public-document-001",
    title: "Sample public handbook",
    description: "Fake local-only public document row.",
    category: "sample",
    file_url: "https://files.example.test/public/handbook.pdf",
    file_name: "handbook.pdf",
    media_id: "sample-media-001",
    published_at: "2026-01-01T00:00:00.000Z",
    status: "published",
    sort_order: 10,
    pinned: 1,
    updated_at: "2026-01-03T00:00:00.000Z"
  }
];

const sampleContentRows = [
  {
    id: "sample-news-001",
    slug: "sample-news",
    type: "news",
    title: "Sample public news",
    summary: "Fake local-only news summary.",
    body_snapshot: "Fake local-only public content body.",
    category: "news",
    publish_at: "2026-02-01T00:00:00.000Z",
    updated_at: "2026-02-02T00:00:00.000Z",
    featured: 1
  },
  {
    id: "sample-program-001",
    slug: "sample-program",
    type: "program",
    title: "Sample program",
    summary: "Fake local-only program summary.",
    body_snapshot: "Fake local-only program body.",
    category: "program",
    publish_at: "2026-03-01T00:00:00.000Z",
    updated_at: "2026-03-02T00:00:00.000Z",
    featured: 1
  }
];

const sampleHomeSections = [
  {
    id: "sample-home-section-001",
    section_key: "intro",
    title: "Sample intro",
    summary: "Fake local-only homepage section.",
    href: "https://preview.example.test/intro",
    sort_order: 1,
    enabled: 1,
    updated_at: "2026-04-01T00:00:00.000Z"
  }
];

const sampleVisitorStats = [
  {
    day: new Date().toISOString().slice(0, 10),
    total_views: 12,
    unique_visitors: 5,
    online_users: 2,
    updated_at: "2026-04-02T00:00:00.000Z"
  },
  {
    day: "2026-01-01",
    total_views: 8,
    unique_visitors: 4,
    online_users: 0,
    updated_at: "2026-01-01T00:00:00.000Z"
  }
];

type MockDbOptions = {
  contentRows?: typeof sampleContentRows;
  documentRows?: DocumentRow[];
  homeSections?: typeof sampleHomeSections;
  visitorStatsRows?: typeof sampleVisitorStats;
};

async function readTextAndJson(response: Response) {
  const text = await response.text();

  return {
    text,
    payload: JSON.parse(text) as Record<string, unknown>
  };
}

function createPublicReadMockDb(options: MockDbOptions = {}) {
  const contentRows = options.contentRows ?? sampleContentRows;
  const documentRows = options.documentRows ?? sampleDocuments;
  const homeSections = options.homeSections ?? sampleHomeSections;
  const visitorStatsRows = options.visitorStatsRows ?? sampleVisitorStats;
  const calls: { query: string; bindings: unknown[] }[] = [];

  return {
    calls,
    env: {
      DB: {
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
              let results: unknown[] = [];

              if (/FROM\s+documents/i.test(query)) {
                results = documentRows;
              } else if (/FROM\s+public_home_sections/i.test(query)) {
                results = homeSections;
              } else if (/FROM\s+visitor_daily_stats/i.test(query)) {
                results = visitorStatsRows;
              } else if (/FROM\s+contents/i.test(query)) {
                if (/slug\s*=\s*\?/i.test(query)) {
                  const slug = String(call.bindings[1] ?? "");
                  results = contentRows.filter((row) => row.slug === slug && row.type !== "program");
                } else if (/type\s*=\s*\?/i.test(query)) {
                  results = contentRows.filter((row) => row.type === "program");
                } else if (/LIKE/i.test(query)) {
                  const queryValue = String(call.bindings[2] ?? "")
                    .replaceAll("%", "")
                    .toLowerCase();
                  results = contentRows.filter(
                    (row) =>
                      row.type !== "program" &&
                      [row.title, row.summary, row.body_snapshot, row.category].some((value) =>
                        value.toLowerCase().includes(queryValue)
                      )
                  );
                } else if (/featured\s*=\s*\?/i.test(query)) {
                  results = contentRows.filter((row) => row.type !== "program" && row.featured === 1);
                } else {
                  results = contentRows.filter((row) => row.type !== "program");
                }
              }

              return {
                results: results as T[],
                success: true
              };
            }
          };
        }
      } as unknown as D1Database
    }
  };
}

function expectGeneratedAt(payload: Record<string, unknown>) {
  expect(new Date(String(payload.generatedAt)).toISOString()).toBe(payload.generatedAt);
}

function expectNoLeakage(text: string) {
  expect(text).not.toMatch(
    /stack|SQL|SELECT|D1|file_url|file_name|media_id|published_at|sort_order|body_doc_url|drive_url|script\.google\.com|drive\.google\.com|rcat\.ac\.th|token|secret/i
  );
}

describe("M17 Cloudflare Core public read routes", () => {
  it("documents the M17 public read batch without production endpoint evidence", () => {
    expect(m17Doc).toMatch(/Cloudflare Core Public Read API/i);
    expect(m17Doc).toMatch(/M15\.2 real execute cutover remains deferred/i);
    expect(m17Doc).toMatch(/dev\/preview Worker origins/i);
    expect(m17Doc).toMatch(/Apps Script fallback remains available/i);
    expect(m17Doc).toMatch(/M18: Admin \+ D1 Write Batch Migration/i);
    expect(m17Doc).not.toMatch(/script\.google\.com|drive\.google\.com|rcat\.ac\.th/i);
    expect(m17Doc).not.toMatch(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  });

  it("registers the grouped public read route plan as implemented for M17-B", () => {
    expect(PUBLIC_READ_ROUTE_REGISTRY.map((route) => route.resource)).toEqual([
      "public-document-list",
      "public-home",
      "content-list",
      "content-detail",
      "search",
      "program",
      "visitor-stats"
    ]);
    expect(PUBLIC_READ_ROUTE_REGISTRY.find((route) => route.resource === "public-document-list")).toMatchObject({
      implemented: true,
      method: "GET",
      pathPattern: "/api/public/documents"
    });
    expect(PUBLIC_READ_ROUTE_REGISTRY.every((route) => route.implemented)).toBe(true);
  });

  it("keeps the existing public-document-list route working", async () => {
    const { env } = createPublicReadMockDb();
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), env);
    const { payload, text } = await readTextAndJson(response);

    expect(response.status).toBe(200);
    expect(payload.items).toEqual([
      expect.objectContaining({
        id: "sample-public-document-001",
        fileUrl: "https://files.example.test/public/handbook.pdf"
      })
    ]);
    expectGeneratedAt(payload);
    expectNoLeakage(text);
  });

  it("returns a D1-backed public home response instead of the M17 skeleton", async () => {
    const { env } = createPublicReadMockDb();
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/home"), env);
    const { payload, text } = await readTextAndJson(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      sections: [expect.objectContaining({ id: "sample-home-section-001", key: "intro" })],
      featuredContent: [expect.objectContaining({ slug: "sample-news" })],
      featuredDocuments: [expect.objectContaining({ id: "sample-public-document-001" })],
      programs: [expect.objectContaining({ slug: "sample-program" })]
    });
    expectGeneratedAt(payload);
    expectNoLeakage(text);
  });

  it("returns a public content list response instead of the M17 skeleton", async () => {
    const { env } = createPublicReadMockDb();
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/content"), env);
    const { payload, text } = await readTextAndJson(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      items: [expect.objectContaining({ slug: "sample-news", content: "Fake local-only public content body." })]
    });
    expect(JSON.stringify(payload)).not.toContain("sample-program");
    expectGeneratedAt(payload);
    expectNoLeakage(text);
  });

  it("returns a public content detail item or a safe 404", async () => {
    const { env } = createPublicReadMockDb();
    const foundResponse = await worker.fetch(
      new Request("https://public-api.example.test/api/public/content/sample-news"),
      env
    );
    const found = await readTextAndJson(foundResponse);

    expect(foundResponse.status).toBe(200);
    expect(found.payload).toMatchObject({
      item: {
        id: "sample-news-001",
        slug: "sample-news",
        title: "Sample public news",
        summary: "Fake local-only news summary.",
        content: "Fake local-only public content body.",
        category: "news",
        publishedAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z"
      }
    });
    expectGeneratedAt(found.payload);
    expectNoLeakage(found.text);

    const missingResponse = await worker.fetch(
      new Request("https://public-api.example.test/api/public/content/missing"),
      env
    );

    expect(missingResponse.status).toBe(404);
    await expect(readTextAndJson(missingResponse)).resolves.toEqual({
      text: JSON.stringify({
        error: "not found",
        resource: "content-detail"
      }),
      payload: {
        error: "not found",
        resource: "content-detail"
      }
    });
  });

  it("returns a public search response instead of the M17 skeleton", async () => {
    const { env } = createPublicReadMockDb();
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/search?q=news"), env);
    const { payload, text } = await readTextAndJson(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      query: "news",
      items: [expect.objectContaining({ slug: "sample-news" })]
    });
    expectGeneratedAt(payload);
    expectNoLeakage(text);
  });

  it("returns a public programs response instead of the M17 skeleton", async () => {
    const { env } = createPublicReadMockDb();
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/programs"), env);
    const { payload, text } = await readTextAndJson(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      items: [expect.objectContaining({ slug: "sample-program" })]
    });
    expectGeneratedAt(payload);
    expectNoLeakage(text);
  });

  it("returns public visitor stats instead of the M17 skeleton", async () => {
    const { env } = createPublicReadMockDb();
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/visitor-stats"), env);
    const { payload, text } = await readTextAndJson(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      total: 20,
      today: 12
    });
    expectGeneratedAt(payload);
    expectNoLeakage(text);
  });

  it("keeps OPTIONS safe for new public read routes", async () => {
    const response = await worker.fetch(
      new Request("https://public-api.example.test/api/public/home", {
        method: "OPTIONS"
      }),
      {}
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
  });

  it("allows only GET and OPTIONS for the public read route foundation", async () => {
    const response = await worker.fetch(
      new Request("https://public-api.example.test/api/public/home", {
        method: "POST"
      }),
      {}
    );
    const { payload } = await readTextAndJson(response);

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, OPTIONS");
    expect(payload).toEqual({
      error: "method not allowed"
    });
  });
});
