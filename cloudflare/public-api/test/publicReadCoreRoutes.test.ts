import { describe, expect, it } from "vitest";
import m17Doc from "../../../docs/architecture/m17-cloudflare-core-public-read-batch-2026-06-13.md?raw";
import type { DocumentRow, EventRow } from "../src/db/schema";
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
    status: "published",
    title: "Sample public news",
    summary: "Fake local-only news summary.",
    body_snapshot: "Fake local-only public content body.",
    category: "news",
    featured_media_id: "sample-media-001",
    media_ids_json: "[]",
    publish_at: "2026-02-01T00:00:00.000Z",
    updated_at: "2026-02-02T00:00:00.000Z",
    featured: 1,
    deleted_at: ""
  },
  {
    id: "sample-program-001",
    slug: "sample-program",
    type: "program",
    status: "published",
    title: "Sample program",
    summary: "Fake local-only program summary.",
    body_snapshot: "Fake local-only program body.",
    category: "program",
    featured_media_id: "sample-media-002",
    media_ids_json: "[]",
    publish_at: "2026-03-01T00:00:00.000Z",
    updated_at: "2026-03-02T00:00:00.000Z",
    featured: 1,
    deleted_at: ""
  }
];

const sampleMediaRows = [
  {
    id: "sample-media-001",
    name: "Sample news image",
    type: "image",
    size: "",
    owner: "",
    drive_url: "https://files.example.test/public/news.jpg",
    file_id: "",
    mime_type: "image/jpeg",
    preview_url: "https://files.example.test/public/news.jpg",
    embed_url: "",
    thumbnail_url: "",
    updated_at: "2026-02-02T00:00:00.000Z"
  },
  {
    id: "sample-media-002",
    name: "Sample program image",
    type: "image",
    size: "",
    owner: "",
    drive_url: "https://files.example.test/public/program.jpg",
    file_id: "",
    mime_type: "image/jpeg",
    preview_url: "https://files.example.test/public/program.jpg",
    embed_url: "",
    thumbnail_url: "",
    updated_at: "2026-03-02T00:00:00.000Z"
  },
  {
    id: "sample-media-unreferenced",
    name: "Unreferenced media",
    type: "image",
    size: "",
    owner: "",
    drive_url: "https://files.example.test/private/unreferenced.jpg",
    file_id: "",
    mime_type: "image/jpeg",
    preview_url: "",
    embed_url: "",
    thumbnail_url: "",
    updated_at: "2026-03-03T00:00:00.000Z"
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
    day: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10),
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
  eventRows?: EventRow[];
  homeSections?: typeof sampleHomeSections;
  mediaRows?: typeof sampleMediaRows;
  onlineUsers?: number;
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
  const eventRows = options.eventRows ?? [];
  const homeSections = options.homeSections ?? sampleHomeSections;
  const mediaRows = options.mediaRows ?? sampleMediaRows;
  const onlineUsers = options.onlineUsers ?? 2;
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

              if (/COUNT\(DISTINCT visitor_id\)/i.test(query)) {
                results = [{ online_users: onlineUsers }];
              } else if (/FROM\s+documents/i.test(query)) {
                results = documentRows;
              } else if (/FROM\s+public_home_sections/i.test(query)) {
                results = homeSections;
              } else if (/FROM\s+visitor_daily_stats/i.test(query)) {
                results = visitorStatsRows;
              } else if (/FROM\s+events/i.test(query)) {
                const [visibility, status] = call.bindings;

                results = eventRows
                  .filter((row) => row.visibility === visibility && row.status === status)
                  .sort(
                    (left, right) =>
                      right.date.localeCompare(left.date) || right.updated_at.localeCompare(left.updated_at)
                  );
              } else if (/FROM\s+media_assets/i.test(query)) {
                results = mediaRows;
              } else if (/FROM\s+contents/i.test(query)) {
                let visibleContentRows = /deleted_at/i.test(query)
                  ? contentRows.filter((row) => !row.deleted_at)
                  : contentRows;

                if (/status\s*=\s*\?/i.test(query)) {
                  const expectedStatus = String(call.bindings[0] ?? "");
                  const now = String(call.bindings[1] ?? "");
                  visibleContentRows = visibleContentRows.filter(
                    (row) =>
                      row.status === expectedStatus &&
                      (String(row.publish_at ?? "") === "" || String(row.publish_at) <= now)
                  );
                }

                if (/slug\s*=\s*\?/i.test(query)) {
                  const slug = String(call.bindings[2] ?? "");
                  results = visibleContentRows.filter((row) => row.slug === slug || row.id === slug);
                } else if (/type\s*=\s*\?/i.test(query)) {
                  const type = String(call.bindings[2] ?? "");
                  results = visibleContentRows.filter((row) => row.type === type);
                } else if (/LIKE/i.test(query)) {
                  const queryValue = String(call.bindings[2] ?? "")
                    .replaceAll("%", "")
                    .toLowerCase();
                  results = visibleContentRows.filter(
                    (row) =>
                      row.type !== "program" &&
                      [row.title, row.summary, row.body_snapshot, row.category].some((value) =>
                        value.toLowerCase().includes(queryValue)
                      )
                  );
                } else if (/featured\s*=\s*\?/i.test(query)) {
                  results = visibleContentRows.filter((row) => row.type !== "program" && row.featured === 1);
                } else {
                  results = visibleContentRows;
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
      siteSettings: expect.any(Object),
      homepageSettings: expect.any(Object),
      displaySettings: expect.any(Object),
      menu: expect.any(Array),
      carouselSlides: expect.any(Array),
      externalServices: expect.any(Array),
      visitorStats: expect.any(Object),
      latestNews: [expect.objectContaining({ slug: "sample-news", type: "news" })],
      latestAnnouncements: expect.any(Array),
      procurementItems: expect.any(Array),
      jobOpportunityItems: expect.any(Array),
      achievementItems: expect.any(Array),
      programItems: [expect.objectContaining({ slug: "sample-program", type: "program" })],
      documentItems: expect.any(Array),
      eventItems: expect.any(Array),
      media: expect.any(Array),
      sections: [expect.objectContaining({ id: "sample-home-section-001", key: "intro" })],
      featuredContent: [expect.objectContaining({ slug: "sample-news" })],
      featuredDocuments: [expect.objectContaining({ id: "sample-public-document-001" })],
      programs: [expect.objectContaining({ slug: "sample-program" })]
    });
    expect(payload.media).toEqual([
      expect.objectContaining({ id: "sample-media-001" }),
      expect.objectContaining({ id: "sample-media-002" })
    ]);
    expectGeneratedAt(payload);
    expectNoLeakage(text);
  });

  it("includes newly published news on the homepage without requiring featured metadata", async () => {
    const publishedNews = { ...sampleContentRows[0], featured: 0 };
    const { env } = createPublicReadMockDb({ contentRows: [publishedNews] });
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/home"), env);
    const { payload } = await readTextAndJson(response);

    expect(response.status).toBe(200);
    expect(payload.latestNews).toEqual([expect.objectContaining({ id: publishedNews.id })]);
    expect(payload.featuredContent).toEqual([]);
  });

  it("limits public home achievements to the latest six items", async () => {
    const achievementRows = Array.from({ length: 8 }, (_, index) => {
      const number = index + 1;
      const day = String(number).padStart(2, "0");

      return {
        ...sampleContentRows[0],
        id: `sample-achievement-${number}`,
        slug: `sample-achievement-${number}`,
        title: `Achievement ${number}`,
        summary: "Award achievement",
        category: "award",
        publish_at: `2026-05-${day}T00:00:00.000Z`,
        updated_at: `2026-05-${day}T00:00:00.000Z`,
        featured: 0
      };
    }).reverse();
    const { env } = createPublicReadMockDb({ contentRows: achievementRows });
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/home"), env);
    const { payload } = await readTextAndJson(response);

    expect(response.status).toBe(200);
    expect(payload.achievementItems).toEqual(
      [8, 7, 6, 5, 4, 3].map((number) =>
        expect.objectContaining({
          id: `sample-achievement-${number}`,
          title: `Achievement ${number}`
        })
      )
    );
  });

  it("includes media referenced by public homepage events and excludes private or unreferenced media", async () => {
    const eventRows: EventRow[] = [
      {
        id: "event-later",
        title: "Later public event",
        date: "2026-07-20T09:00:00.000Z",
        end_date: "2026-07-20T11:00:00.000Z",
        audience: "students",
        status: "confirmed",
        location: "Main hall",
        description: "",
        category: "academic",
        visibility: "public",
        media_ids_json: '["sample-event-media"]',
        updated_at: "2026-07-10T00:00:00.000Z"
      },
      {
        id: "event-sooner",
        title: "Sooner public event",
        date: "2026-07-10T09:00:00.000Z",
        end_date: "2026-07-10T11:00:00.000Z",
        audience: "students",
        status: "confirmed",
        location: "Auditorium",
        description: "",
        category: "academic",
        visibility: "public",
        media_ids_json: "[]",
        updated_at: "2026-07-09T00:00:00.000Z"
      },
      {
        id: "event-draft",
        title: "Draft event",
        date: "2026-07-30T09:00:00.000Z",
        end_date: "2026-07-30T11:00:00.000Z",
        audience: "staff",
        status: "draft",
        location: "",
        description: "",
        category: "",
        visibility: "public",
        media_ids_json: '["sample-media-unreferenced"]',
        updated_at: "2026-07-11T00:00:00.000Z"
      },
      {
        id: "event-private",
        title: "Private event",
        date: "2026-07-25T09:00:00.000Z",
        end_date: "2026-07-25T11:00:00.000Z",
        audience: "staff",
        status: "confirmed",
        location: "",
        description: "",
        category: "",
        visibility: "private",
        media_ids_json: '["sample-media-unreferenced"]',
        updated_at: "2026-07-11T00:00:00.000Z"
      }
    ];

    const mediaRows = [
      ...sampleMediaRows,
      {
        id: "sample-event-media",
        name: "Event image",
        type: "image",
        size: "",
        owner: "",
        drive_url: "https://files.example.test/public/event.jpg",
        file_id: "",
        mime_type: "image/jpeg",
        preview_url: "https://files.example.test/public/event.jpg",
        embed_url: "",
        thumbnail_url: "",
        updated_at: "2026-07-10T00:00:00.000Z"
      }
    ];

    const { env, calls } = createPublicReadMockDb({
      eventRows,
      mediaRows
    });

    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/home"), env);

    const { payload, text } = await readTextAndJson(response);

    expect(response.status).toBe(200);

    expect(payload.eventItems).toEqual([
      expect.objectContaining({
        id: "event-later",
        mediaIds: ["sample-event-media"]
      }),
      expect.objectContaining({
        id: "event-sooner",
        mediaIds: []
      })
    ]);

    expect(
      (
        payload.media as Array<{
          id: string;
        }>
      ).map((item) => item.id)
    ).toEqual(["sample-media-001", "sample-media-002", "sample-event-media"]);

    expect(JSON.stringify(payload)).not.toContain("event-draft");

    expect(JSON.stringify(payload)).not.toContain("event-private");

    expect(JSON.stringify(payload)).not.toContain("sample-media-unreferenced");

    const eventQuery = calls.find((call) => /FROM\s+events/i.test(call.query));

    expect(eventQuery?.bindings).toEqual(["public", "confirmed"]);

    expect(eventQuery?.query).toMatch(/ORDER BY date DESC/i);

    expectNoLeakage(text);
  });

  it("returns a public content list response instead of the M17 skeleton", async () => {
    const { env } = createPublicReadMockDb();
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/content"), env);
    const { payload, text } = await readTextAndJson(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      kind: "news",
      siteSettings: expect.any(Object),
      homepageSettings: expect.any(Object),
      displaySettings: expect.any(Object),
      menu: expect.any(Array),
      media: expect.any(Array),
      items: [
        expect.objectContaining({
          slug: "sample-news",
          type: "news",
          status: "published",
          owner: "",
          body: "Fake local-only public content body.",
          content: "Fake local-only public content body."
        })
      ]
    });
    expect(payload.media).toEqual([expect.objectContaining({ id: "sample-media-001" })]);
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
        type: "news",
        status: "published",
        owner: "",
        summary: "Fake local-only news summary.",
        body: "Fake local-only public content body.",
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

    const programResponse = await worker.fetch(
      new Request("https://public-api.example.test/api/public/content/sample-program"),
      env
    );
    const program = await readTextAndJson(programResponse);

    expect(programResponse.status).toBe(200);
    expect(program.payload).toMatchObject({
      item: {
        id: "sample-program-001",
        slug: "sample-program",
        type: "program",
        status: "published"
      }
    });
    expectNoLeakage(program.text);
  });

  it("returns a public search response instead of the M17 skeleton", async () => {
    const { env } = createPublicReadMockDb();
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/search?q=news"), env);
    const { payload, text } = await readTextAndJson(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      query: "news",
      siteSettings: expect.any(Object),
      homepageSettings: expect.any(Object),
      displaySettings: expect.any(Object),
      menu: expect.any(Array),
      items: [expect.objectContaining({ slug: "sample-news", type: "news", status: "published" })]
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
      siteSettings: expect.any(Object),
      homepageSettings: expect.any(Object),
      displaySettings: expect.any(Object),
      menu: expect.any(Array),
      media: expect.any(Array),
      items: [expect.objectContaining({ slug: "sample-program", type: "program", status: "published" })]
    });
    expect(payload.media).toEqual([expect.objectContaining({ id: "sample-media-002" })]);
    expectGeneratedAt(payload);
    expectNoLeakage(text);
  });

  it("excludes a soft-deleted program from both list and detail", async () => {
    const deletedProgram = { ...sampleContentRows[1], deleted_at: "2026-06-21T00:00:00.000Z" };
    const { env, calls } = createPublicReadMockDb({ contentRows: [sampleContentRows[0], deletedProgram] });

    const listResponse = await worker.fetch(new Request("https://public-api.example.test/api/public/programs"), env);
    const list = await readTextAndJson(listResponse);
    const detailResponse = await worker.fetch(
      new Request("https://public-api.example.test/api/public/content/sample-program"),
      env
    );

    expect(listResponse.status).toBe(200);
    expect(list.payload.items).toEqual([]);
    expect(detailResponse.status).toBe(404);
    expect(
      calls.filter((call) => /FROM\s+contents/i.test(call.query)).every((call) => /deleted_at/i.test(call.query))
    ).toBe(true);
  });

  it("excludes future-dated published content from every public content read", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    const visibleWithoutDate = {
      ...sampleContentRows[0],
      id: "visible-without-date",
      slug: "visible-without-date",
      title: "Visible without date",
      publish_at: ""
    };
    const visiblePast = {
      ...sampleContentRows[0],
      id: "visible-past",
      slug: "visible-past",
      title: "Visible past",
      publish_at: past
    };
    const futureNews = {
      ...sampleContentRows[0],
      id: "future-news",
      slug: "future-news",
      title: "Future scheduled news",
      publish_at: future
    };
    const visibleProgram = {
      ...sampleContentRows[1],
      id: "visible-program",
      slug: "visible-program",
      publish_at: past
    };
    const futureProgram = {
      ...sampleContentRows[1],
      id: "future-program",
      slug: "future-program",
      title: "Future program",
      publish_at: future
    };
    const { env, calls } = createPublicReadMockDb({
      contentRows: [visibleWithoutDate, visiblePast, futureNews, visibleProgram, futureProgram]
    });
    const list = await readTextAndJson(
      await worker.fetch(new Request("https://public-api.example.test/api/public/content"), env)
    );
    const home = await readTextAndJson(
      await worker.fetch(new Request("https://public-api.example.test/api/public/home"), env)
    );
    const search = await readTextAndJson(
      await worker.fetch(new Request("https://public-api.example.test/api/public/search?q=Future"), env)
    );
    const futureDetail = await worker.fetch(
      new Request("https://public-api.example.test/api/public/content/future-news"),
      env
    );
    const visibleDetail = await worker.fetch(
      new Request("https://public-api.example.test/api/public/content/visible-past"),
      env
    );
    const programs = await readTextAndJson(
      await worker.fetch(new Request("https://public-api.example.test/api/public/programs"), env)
    );

    expect((list.payload.items as Array<{ id: string }>).map((item) => item.id).sort()).toEqual([
      "visible-past",
      "visible-without-date"
    ]);
    expect((home.payload.latestNews as Array<{ id: string }>).some((item) => item.id === futureNews.id)).toBe(false);
    expect(search.payload.items).toEqual([]);
    expect(futureDetail.status).toBe(404);
    expect(visibleDetail.status).toBe(200);
    expect(programs.payload.items).toEqual([expect.objectContaining({ id: visibleProgram.id })]);
    expect(
      calls
        .filter((call) => /FROM\s+contents/i.test(call.query))
        .every((call) =>
          /COALESCE\(publish_at, ''\) = '' OR datetime\(publish_at\) <= datetime\(\?\)/i.test(call.query)
        )
    ).toBe(true);
  });

  it("returns public visitor stats instead of the M17 skeleton", async () => {
    const { env } = createPublicReadMockDb();
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/visitor-stats"), env);
    const { payload, text } = await readTextAndJson(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      total: 20,
      today: 12,
      enabled: true,
      usersToday: 5,
      usersYesterday: expect.any(Number),
      usersThisMonth: expect.any(Number),
      usersThisYear: expect.any(Number),
      totalUsers: 9,
      totalViews: 20,
      onlineUsers: 2,
      updatedAt: expect.any(String)
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
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
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
