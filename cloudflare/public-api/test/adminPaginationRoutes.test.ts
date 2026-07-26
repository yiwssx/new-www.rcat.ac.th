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

type Row = Record<string, unknown>;

const cmsProxySecret = "phase-8-pagination-proxy-secret-repeated-000000";
const cmsCsrfToken = "C".repeat(43);
const roleSessionTokens = {
  admin: "A".repeat(43),
  editor: "E".repeat(43),
  viewer: "V".repeat(43)
};
const baseEnv = {
  CMS_AUTH_PROXY_SECRET: cmsProxySecret,
  ENVIRONMENT: "preview"
};

authenticateCmsSessionMock.mockImplementation(async ({ sessionToken }: { sessionToken: string }) => {
  const role =
    (Object.entries(roleSessionTokens).find(([, token]) => token === sessionToken)?.[0] as
      "admin" | "editor" | "viewer" | undefined) ?? "viewer";

  return {
    status: "authenticated",
    identity: {
      id: `${role}-user`,
      email: `${role}@example.invalid`,
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

function tableFromQuery(query: string) {
  if (/\bFROM\s+app_admin_users\s+AS\s+u\b[\s\S]*\bORDER\s+BY\b/i.test(query)) {
    return "app_admin_users";
  }

  return query.match(/\bFROM\s+([a-z_]+)/i)?.[1] ?? "";
}

function activeRows(table: string, rows: Row[]) {
  return table === "contents" || table === "documents"
    ? rows.filter((row) => String(row.deleted_at ?? "") === "")
    : [...rows];
}

function searchNeedle(pattern: unknown) {
  return String(pattern ?? "")
    .replace(/^%|%$/g, "")
    .replace(/\\([\\%_])/g, "$1")
    .toLowerCase();
}

function filterContentRows(query: string, bindings: unknown[], source: Row[]) {
  let rows = activeRows("contents", source);
  let bindingIndex = 0;

  if (/\bLIKE\s+\?/i.test(query)) {
    const likeCount = (query.match(/\bLIKE\s+\?/gi) ?? []).length;
    const needle = searchNeedle(bindings[bindingIndex]);
    const fields = ["title", "summary", "slug", "category", "owner", "tags_json"];
    rows = rows.filter((row) =>
      fields.some((field) =>
        String(row[field] ?? "")
          .toLowerCase()
          .includes(needle)
      )
    );
    bindingIndex += likeCount;
  }

  const filtersPublishableQueue =
    /status\s*=\s*\?\s+OR\s+\(status\s*=\s*\?[\s\S]*datetime\(publish_at\)\s*<=\s*datetime\(\?\)/i.test(query);

  if (filtersPublishableQueue) {
    const reviewStatus = String(bindings[bindingIndex]);
    const scheduledStatus = String(bindings[bindingIndex + 1]);
    const now = String(bindings[bindingIndex + 2]);
    rows = rows.filter(
      (row) =>
        row.status === reviewStatus ||
        (row.status === scheduledStatus && String(row.publish_at ?? "") !== "" && String(row.publish_at) <= now)
    );
    bindingIndex += 3;
  }

  const exactFilters: Array<[RegExp, string]> = [
    [/\bstatus\s*=\s*\?/i, "status"],
    [/\btype\s*=\s*\?/i, "type"],
    [/\bcategory\s*=\s*\?/i, "category"],
    [/\bowner\s*=\s*\?/i, "owner"],
    [/\bfeatured\s*=\s*\?/i, "featured"]
  ];

  exactFilters.forEach(([pattern, field]) => {
    if (pattern.test(query) && !(field === "status" && filtersPublishableQueue)) {
      const expected = bindings[bindingIndex];
      bindingIndex += 1;
      rows = rows.filter((row) => row[field] === expected);
    }
  });

  if (/\bstatus\s*<>\s*\?/i.test(query)) {
    const expected = bindings[bindingIndex];
    bindingIndex += 1;
    rows = rows.filter((row) => row.status !== expected);
  }

  if (/ORDER BY\s+title\s+ASC/i.test(query)) {
    rows.sort((left, right) => String(left.title).localeCompare(String(right.title)));
  } else {
    rows.sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)));
  }

  return rows;
}

function groupRows(rows: Row[], key: string) {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const value = String(row[key] ?? "");
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return [...counts.entries()].map(([value, total]) => ({ key: key === "enabled" ? Number(value) : value, total }));
}

function createPaginationDb(initial: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    contents: [],
    documents: [],
    media_assets: [],
    events: [],
    app_admin_users: [],
    carousel_slides: [],
    external_services: [],
    menu_items: [],
    visitor_daily_stats: [],
    ...initial
  };
  const calls: Array<{ bindings: unknown[]; query: string }> = [];

  function selectRows(query: string, bindings: unknown[]) {
    const table = tableFromQuery(query);
    const source = tables[table] ?? [];

    if (table === "visitor_daily_stats" && /SUM\(total_views\)/i.test(query)) {
      const [today, yesterday, month, year] = bindings.map(String);
      const sum = (field: string, predicate: (row: Row) => boolean = () => true) =>
        source.filter(predicate).reduce((total, row) => total + Number(row[field] ?? 0), 0);
      return [
        {
          total_views: sum("total_views"),
          total_users: sum("unique_visitors"),
          users_today: sum("unique_visitors", (row) => row.day === today),
          users_yesterday: sum("unique_visitors", (row) => row.day === yesterday),
          users_this_month: sum("unique_visitors", (row) => String(row.day).startsWith(month)),
          users_this_year: sum("unique_visitors", (row) => String(row.day).startsWith(year)),
          online_users: Math.max(
            0,
            ...source.filter((row) => row.day === today).map((row) => Number(row.online_users ?? 0))
          ),
          updated_at: source.reduce(
            (latest, row) => (String(row.updated_at ?? "") > latest ? String(row.updated_at) : latest),
            ""
          )
        }
      ];
    }

    let rows = table === "contents" ? filterContentRows(query, bindings, source) : activeRows(table, source);

    if (table === "menu_items" && /\bWHERE\s+id\s*=\s*\?/i.test(query)) {
      rows = rows.filter((row) => row.id === bindings[0]);
    }

    if (table === "menu_items" && /\bWHERE\s+parent_id\s*=\s*\?/i.test(query)) {
      rows = rows.filter((row) => row.parent_id === bindings[0]);
    }

    if (/\bstatus\s+AS\s+key/i.test(query) && /GROUP\s+BY\s+status/i.test(query)) {
      return groupRows(rows, "status");
    }

    if (/\benabled\s+AS\s+key/i.test(query) && /GROUP\s+BY\s+enabled/i.test(query)) {
      return groupRows(rows, "enabled");
    }

    if (/\bid\s+IN\s*\(/i.test(query) && table === "media_assets") {
      const ids = new Set(bindings.map(String));
      rows = rows.filter((row) => ids.has(String(row.id)));
    }

    if (table === "events" && /\bstatus\s*<>\s*\?/i.test(query)) {
      rows = rows.filter((row) => row.status !== bindings[0] && String(row.date) >= String(bindings[1]));
    }

    if (/ORDER BY\s+parent_id\s+ASC/i.test(query)) {
      rows.sort(
        (left, right) =>
          String(left.parent_id).localeCompare(String(right.parent_id)) ||
          Number(left.sort_order) - Number(right.sort_order)
      );
    } else if (/ORDER BY\s+pinned\s+(?:ASC|DESC),\s*sort_order\s+ASC/i.test(query)) {
      const descending = /ORDER BY\s+pinned\s+DESC/i.test(query);
      rows.sort(
        (left, right) =>
          (descending ? Number(right.pinned) - Number(left.pinned) : Number(left.pinned) - Number(right.pinned)) ||
          Number(left.sort_order) - Number(right.sort_order)
      );
    } else if (/ORDER BY\s+pinned\s+(?:ASC|DESC)/i.test(query)) {
      const descending = /ORDER BY\s+pinned\s+DESC/i.test(query);
      rows.sort(
        (left, right) =>
          (descending ? Number(right.pinned) - Number(left.pinned) : Number(left.pinned) - Number(right.pinned)) ||
          String(left.id).localeCompare(String(right.id))
      );
    } else if (/ORDER BY\s+sort_order\s+ASC/i.test(query)) {
      rows.sort((left, right) => Number(left.sort_order) - Number(right.sort_order));
    } else if (table === "events" && /ORDER BY\s+date\s+DESC/i.test(query)) {
      rows.sort((left, right) => String(right.date).localeCompare(String(left.date)));
    } else if (table === "events" && /ORDER BY\s+date\s+ASC/i.test(query)) {
      rows.sort((left, right) => String(left.date).localeCompare(String(right.date)));
    }

    if (/COUNT\(\*\)\s+AS\s+total/i.test(query)) {
      return [{ total: rows.length }];
    }

    const boundLimit = query.match(/LIMIT\s+\?\s+OFFSET\s+\?/i);

    if (boundLimit) {
      const limit = Number(bindings.at(-2));
      const offset = Number(bindings.at(-1));
      rows = rows.slice(offset, offset + limit);
    } else {
      const literalLimit = Number(query.match(/LIMIT\s+(\d+)/i)?.[1] ?? 0);

      if (literalLimit > 0) {
        rows = rows.slice(0, literalLimit);
      }
    }

    return rows;
  }

  const db = {
    prepare(query: string) {
      const call = { query, bindings: [] as unknown[] };
      calls.push(call);

      return {
        bind(...values: unknown[]) {
          call.bindings.push(...values);
          return this;
        },
        async all<T>() {
          return { results: selectRows(query, call.bindings) as T[], success: true };
        },
        async first<T>() {
          return (selectRows(query, call.bindings)[0] ?? null) as T | null;
        },
        async run() {
          if (/^\s*UPDATE\s+contents/i.test(query)) {
            let changes = 0;
            const results: Array<{ id: unknown }> = [];
            const reviewStatus = String(call.bindings[1]);
            const reviewPublishAt = String(call.bindings[2]);
            const updatedAt = String(call.bindings[3]);
            const updatedBy = String(call.bindings[4]);
            const eligibleReviewStatus = String(call.bindings[5]);
            const scheduledStatus = String(call.bindings[6]);
            const now = String(call.bindings[7]);

            tables.contents.forEach((row) => {
              const currentStatus = String(row.status);
              const publishable =
                currentStatus === eligibleReviewStatus ||
                (currentStatus === scheduledStatus &&
                  String(row.publish_at ?? "") !== "" &&
                  String(row.publish_at) <= now);

              if (String(row.deleted_at ?? "") === "" && publishable) {
                row.status = "published";
                row.publish_at = currentStatus === reviewStatus ? reviewPublishAt : row.publish_at;
                row.updated_at = updatedAt;
                row.updated_by = updatedBy;
                row.revision = Number(row.revision ?? 0) + 1;
                changes += 1;
                results.push({ id: row.id });
              }
            });
            return { results, success: true, meta: { changes } };
          }

          if (/^\s*WITH\s+submitted/i.test(query)) {
            const table = query.match(/\bUPDATE\s+([a-z_]+)/i)?.[1] ?? "";
            const submitted = JSON.parse(String(call.bindings[0])) as Array<{
              flag: number;
              id: string;
              order: number;
              parentId: string;
              revision: number;
            }>;
            const rows = tables[table] ?? [];
            const active = activeRows(table, rows);
            const valid =
              submitted.every((item) => {
                const row = rows.find((candidate) => candidate.id === item.id);
                return (
                  row &&
                  Number(row.revision ?? 0) === item.revision &&
                  (table !== "menu_items" || String(row.parent_id ?? "") === item.parentId) &&
                  (table !== "documents" || String(row.deleted_at ?? "") === "")
                );
              }) && submitted.length === active.length;

            if (!valid) {
              return { results: [], success: true, meta: { changes: 0 } };
            }

            submitted.forEach((item) => {
              const row = rows.find((candidate) => candidate.id === item.id)!;
              row.sort_order = item.order;
              row[table === "documents" ? "pinned" : "enabled"] = item.flag;
              row.updated_at = call.bindings[1];
              row.updated_by = call.bindings[2];
              row.revision = Number(row.revision ?? 0) + 1;
            });
            return {
              results: submitted.map((item) => ({ id: item.id })),
              success: true,
              meta: { changes: submitted.length }
            };
          }

          if (/^\s*INSERT\s+INTO\s+menu_items/i.test(query)) {
            const columns =
              query
                .match(/INSERT\s+INTO\s+menu_items\s*\(([^)]+)\)/i)?.[1]
                ?.split(",")
                .map((column) => column.trim()) ?? [];
            tables.menu_items.push(Object.fromEntries(columns.map((column, index) => [column, call.bindings[index]])));
            return { success: true, meta: { changes: 1 } };
          }

          if (/^\s*UPDATE\s+menu_items/i.test(query)) {
            const id = call.bindings[7];
            const revision = Number(call.bindings[8]);
            const row = tables.menu_items.find(
              (candidate) => candidate.id === id && Number(candidate.revision ?? 0) === revision
            );

            if (!row) {
              return { success: true, meta: { changes: 0 } };
            }

            ["parent_id", "label", "href", "enabled", "sort_order", "updated_at", "updated_by"].forEach(
              (column, index) => {
                row[column] = call.bindings[index];
              }
            );
            row.revision = revision + 1;
            return { success: true, meta: { changes: 1 } };
          }

          if (/^\s*DELETE\s+FROM\s+menu_items/i.test(query)) {
            const index = tables.menu_items.findIndex(
              (row) => row.id === call.bindings[0] && Number(row.revision ?? 0) === Number(call.bindings[1])
            );

            if (index < 0) {
              return { success: true, meta: { changes: 0 } };
            }

            tables.menu_items.splice(index, 1);
            return { success: true, meta: { changes: 1 } };
          }

          return { success: true, meta: { changes: 0 } };
        }
      };
    },
    async batch() {
      return [];
    }
  } as unknown as D1Database;

  return { calls, db, tables };
}

function contentRow(index: number, overrides: Row = {}): Row {
  const timestamp = new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString();
  return {
    id: `content-${String(index).padStart(3, "0")}`,
    slug: `content-${index}`,
    type: "news",
    status: "draft",
    owner: "editor@example.invalid",
    title: `Content ${String(index).padStart(3, "0")}`,
    summary: `Summary ${index}`,
    tags_json: "[]",
    body_snapshot: `Heavy body ${index}`,
    category: "general",
    canonical_url: "",
    featured: 0,
    template: "standard",
    featured_media_id: "",
    view_count: index,
    last_viewed_at: "",
    updated_at: timestamp,
    publish_at: timestamp,
    deleted_at: "",
    updated_by: "editor@example.invalid",
    revision: 0,
    ...overrides
  };
}

function documentRow(id: string, overrides: Row = {}): Row {
  return {
    id,
    title: `Document ${id}`,
    description: "Description that must survive compact ordering",
    category: "general",
    file_url: `https://files.example.invalid/${id}.pdf`,
    file_name: `${id}.pdf`,
    media_id: "",
    published_at: "",
    status: "draft",
    sort_order: 0,
    pinned: 0,
    updated_at: "2026-07-01T00:00:00.000Z",
    deleted_at: "",
    updated_by: "admin@example.invalid",
    revision: 0,
    ...overrides
  };
}

function allEntityRows() {
  return {
    contents: [contentRow(1)],
    documents: [documentRow("document-1")],
    media_assets: [
      {
        id: "media-1",
        name: "Photo",
        type: "image",
        size: "10 KB",
        owner: "Admin",
        drive_url: "https://drive.example.invalid/media-1",
        file_id: "file-1",
        mime_type: "image/jpeg",
        preview_url: "",
        embed_url: "",
        thumbnail_url: "",
        updated_at: "2026-07-01T00:00:00.000Z"
      }
    ],
    events: [
      {
        id: "event-1",
        title: "Event",
        date: "2026-08-01",
        end_date: "",
        audience: "All",
        status: "confirmed",
        location: "Hall",
        description: "",
        category: "general",
        visibility: "public",
        media_ids_json: JSON.stringify(["media-1", "media-1", ""]),
        updated_at: "2026-07-01T00:00:00.000Z",
        revision: 0
      }
    ],
    app_admin_users: [
      {
        id: "user-1",
        email: "admin@example.invalid",
        name: "Admin",
        role: "admin",
        status: "active",
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
        created_by: "admin@example.invalid",
        updated_by: "admin@example.invalid",
        revision: 0
      }
    ],
    carousel_slides: [
      {
        id: "slide-1",
        title: "Slide",
        subtitle: "",
        chip: "",
        image_url: "https://images.example.invalid/slide.jpg",
        image_alt: "",
        button_label: "",
        href: "",
        enabled: 1,
        sort_order: 0,
        start_at: "",
        end_at: "",
        updated_at: "2026-07-01T00:00:00.000Z",
        revision: 0
      }
    ],
    external_services: [
      {
        id: "service-1",
        title: "Service",
        description: "",
        href: "https://service.example.invalid",
        tone: "general",
        icon_key: "link",
        enabled: 1,
        sort_order: 0,
        updated_at: "2026-07-01T00:00:00.000Z",
        revision: 0
      }
    ],
    menu_items: [
      {
        id: "menu-1",
        parent_id: "",
        label: "Home",
        href: "/",
        enabled: 1,
        sort_order: 0,
        updated_at: "2026-07-01T00:00:00.000Z",
        revision: 0
      }
    ]
  };
}

function request(path: string, init: RequestInit & { role?: string } = {}) {
  const headers = new Headers(init.headers);
  const role = (init.role ?? "admin") as "admin" | "editor" | "viewer";
  headers.set(CMS_AUTH_PROXY_SECRET_HEADER, cmsProxySecret);
  headers.set(CMS_SESSION_TOKEN_HEADER, roleSessionTokens[role]);
  headers.set(CMS_CSRF_TOKEN_HEADER, cmsCsrfToken);
  headers.set(CMS_CLIENT_IP_HEADER, "203.0.113.84");
  headers.set(CMS_USER_AGENT_HEADER, "phase-8-pagination-test");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return new Request(`https://preview-worker.example.invalid${path}`, { ...init, headers });
}

async function jsonBody(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function compactOrderItems(entity: string, tables: Record<string, Row[]>) {
  const table = orderTable(entity);

  return activeRows(table, tables[table] ?? []).map((row) => ({
    id: row.id,
    order: row.sort_order,
    revision: Number(row.revision ?? 0),
    ...(entity === "documents" ? { pinned: row.pinned === 1 } : { enabled: row.enabled === 1 }),
    ...(entity === "menu" ? { parentId: row.parent_id || null } : {})
  }));
}

function orderTable(entity: string) {
  return entity === "documents"
    ? "documents"
    : entity === "menu"
      ? "menu_items"
      : entity === "carousel"
        ? "carousel_slides"
        : "external_services";
}

function twoOrderRows(entity: string) {
  const tables: Record<string, Row[]> = allEntityRows();
  const table = orderTable(entity);
  const first = tables[table]?.[0];

  if (!first) {
    throw new Error(`missing ${entity} ordering fixture`);
  }

  const second = {
    ...first,
    id: `${String(first.id)}-second`,
    sort_order: 1,
    revision: 0,
    ...(entity === "menu" ? { label: "Second menu item" } : { title: `Second ${entity} item` })
  };
  tables[table] = [first, second];
  return tables;
}

function reorderedCompactItems(entity: string, tables: Record<string, Row[]>) {
  const items = compactOrderItems(entity, tables);
  return items.map((item, index) => ({ ...item, order: items.length - index }));
}

describe("admin server pagination routes", () => {
  it("keeps list routes authenticated and preserves viewer read plus editor/admin publish RBAC", async () => {
    const state = createPaginationDb({ contents: [contentRow(1, { status: "review" })] });
    const env = { ...baseEnv, DB: state.db };
    const adminState = createPaginationDb({ contents: [contentRow(2, { status: "review" })] });
    const adminEnv = { ...baseEnv, DB: adminState.db };
    const unauthenticated = await worker.fetch(
      new Request("https://preview-worker.example.invalid/api/admin/content"),
      env
    );
    const viewerList = await worker.fetch(request("/api/admin/content", { role: "viewer" }), env);
    const viewerPublish = await worker.fetch(
      request("/api/admin/content/publish-pending", { method: "POST", role: "viewer", body: "{}" }),
      env
    );
    const editorPublish = await worker.fetch(
      request("/api/admin/content/publish-pending", { method: "POST", role: "editor", body: "{}" }),
      env
    );
    const adminPublish = await worker.fetch(
      request("/api/admin/content/publish-pending", { method: "POST", role: "admin", body: "{}" }),
      adminEnv
    );

    expect(unauthenticated.status).toBe(403);
    expect(viewerList.status).toBe(200);
    expect(viewerPublish.status).toBe(403);
    expect(editorPublish.status).toBe(200);
    expect(adminPublish.status).toBe(200);
    await expect(jsonBody(editorPublish)).resolves.toEqual({ publishedCount: 1 });
    await expect(jsonBody(adminPublish)).resolves.toEqual({ publishedCount: 1 });
  });

  it("enforces ordering permissions at the Worker boundary for every compact collection", async () => {
    const entities = ["documents", "menu", "carousel", "external-services"];

    for (const entity of entities) {
      const state = createPaginationDb(allEntityRows());
      const response = await worker.fetch(
        request(`/api/admin/${entity}/order`, {
          method: "PUT",
          role: "viewer",
          body: JSON.stringify({ items: compactOrderItems(entity, state.tables) })
        }),
        { ...baseEnv, DB: state.db }
      );

      expect(response.status, `viewer ${entity}`).toBe(403);
      expect(response.headers.get("Cache-Control"), `viewer ${entity}`).toBe("no-store");
      await expect(jsonBody(response)).resolves.toMatchObject({ resource: `${entity}-order` });
      expect(state.calls.some((call) => /^\s*WITH\s+submitted/i.test(call.query))).toBe(false);
    }

    const editorMenuState = createPaginationDb(allEntityRows());
    const editorMenu = await worker.fetch(
      request("/api/admin/menu/order", {
        method: "PUT",
        role: "editor",
        body: JSON.stringify({ items: compactOrderItems("menu", editorMenuState.tables) })
      }),
      { ...baseEnv, DB: editorMenuState.db }
    );
    expect(editorMenu.status).toBe(403);
    await expect(jsonBody(editorMenu)).resolves.toMatchObject({ resource: "menu-order" });

    for (const entity of ["documents", "carousel"]) {
      const state = createPaginationDb(allEntityRows());
      const response = await worker.fetch(
        request(`/api/admin/${entity}/order`, {
          method: "PUT",
          role: "editor",
          body: JSON.stringify({ items: compactOrderItems(entity, state.tables) })
        }),
        { ...baseEnv, DB: state.db }
      );

      expect(response.status, `editor ${entity}`).toBe(200);
    }

    const editorExternalState = createPaginationDb(allEntityRows());
    const editorExternal = await worker.fetch(
      request("/api/admin/external-services/order", {
        method: "PUT",
        role: "editor",
        body: JSON.stringify({ items: compactOrderItems("external-services", editorExternalState.tables) })
      }),
      { ...baseEnv, DB: editorExternalState.db }
    );
    expect(editorExternal.status).toBe(403);
    await expect(jsonBody(editorExternal)).resolves.toMatchObject({
      error: "required permission is missing",
      resource: "external-services-order"
    });

    for (const entity of entities) {
      const state = createPaginationDb(allEntityRows());
      const response = await worker.fetch(
        request(`/api/admin/${entity}/order`, {
          method: "PUT",
          role: "admin",
          body: JSON.stringify({ items: compactOrderItems(entity, state.tables) })
        }),
        { ...baseEnv, DB: state.db }
      );

      expect(response.status, `admin ${entity}`).toBe(200);
    }
  });

  it("publishes only review and due scheduled content and reports the exact changed count", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    const state = createPaginationDb({
      contents: [
        contentRow(1, { status: "review", publish_at: "" }),
        contentRow(2, { status: "review", publish_at: future }),
        contentRow(3, { status: "draft", publish_at: "" }),
        contentRow(4, { status: "scheduled", publish_at: past }),
        contentRow(5, { status: "scheduled", publish_at: future }),
        contentRow(6, { status: "published", publish_at: past }),
        contentRow(7, { status: "archived", publish_at: past }),
        contentRow(8, { status: "review", publish_at: future, deleted_at: past })
      ]
    });
    const env = { ...baseEnv, DB: state.db };
    const untouchedBefore = new Map(
      ["content-003", "content-005", "content-006", "content-007", "content-008"].map((id) => [
        id,
        JSON.stringify(state.tables.contents.find((row) => row.id === id))
      ])
    );
    const dashboardResponse = await worker.fetch(request("/api/admin/dashboard-summary"), env);
    const dashboard = await jsonBody(dashboardResponse);
    const viewerResponse = await worker.fetch(
      request("/api/admin/content/publish-pending", { method: "POST", role: "viewer", body: "{}" }),
      env
    );
    const publishResponse = await worker.fetch(
      request("/api/admin/content/publish-pending", { method: "POST", role: "editor", body: "{}" }),
      env
    );
    const publishBody = await jsonBody(publishResponse);
    const rowsById = new Map(state.tables.contents.map((row) => [String(row.id), row]));
    const updateCall = state.calls.find((call) => /^\s*UPDATE\s+contents/i.test(call.query));
    const mutationNow = String(updateCall?.bindings[2] ?? "");

    expect(dashboardResponse.status).toBe(200);
    expect(dashboard.publishableCount).toBe(3);
    expect((dashboard.content as Row[]).map((row) => row.id).sort()).toEqual([
      "content-001",
      "content-002",
      "content-004"
    ]);
    expect((dashboard.content as Row[]).some((row) => row.id === "content-005")).toBe(false);
    expect(viewerResponse.status).toBe(403);
    await expect(jsonBody(viewerResponse)).resolves.toMatchObject({ resource: "content-publish-queue" });
    expect(publishResponse.status).toBe(200);
    expect(publishResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(publishBody).toEqual({ publishedCount: 3 });
    expect(mutationNow).not.toBe("");
    expect(updateCall?.bindings[3]).toBe(mutationNow);
    expect(updateCall?.bindings[7]).toBe(mutationNow);
    expect(rowsById.get("content-001")).toMatchObject({ status: "published", publish_at: mutationNow, revision: 1 });
    expect(rowsById.get("content-002")).toMatchObject({ status: "published", publish_at: mutationNow, revision: 1 });
    expect(rowsById.get("content-004")).toMatchObject({ status: "published", publish_at: past, revision: 1 });
    untouchedBefore.forEach((snapshot, id) => {
      expect(JSON.stringify(rowsById.get(id)), id).toBe(snapshot);
    });
  });

  it("rejects empty ordering payloads for non-empty collections and accepts genuinely empty collections", async () => {
    for (const entity of ["documents", "menu", "carousel", "external-services"]) {
      const nonEmptyState = createPaginationDb(allEntityRows());
      const table = orderTable(entity);
      const before = JSON.stringify(nonEmptyState.tables[table]);
      const rejected = await worker.fetch(
        request(`/api/admin/${entity}/order`, {
          method: "PUT",
          role: "admin",
          body: JSON.stringify({ items: [] })
        }),
        { ...baseEnv, DB: nonEmptyState.db }
      );

      expect(rejected.status, `non-empty ${entity}`).toBe(409);
      expect(rejected.headers.get("Cache-Control"), `non-empty ${entity}`).toBe("no-store");
      await expect(jsonBody(rejected)).resolves.toMatchObject({ error: "stale revision", resource: `${entity}-order` });
      expect(JSON.stringify(nonEmptyState.tables[table]), `unchanged ${entity}`).toBe(before);
      expect(
        nonEmptyState.calls.some((call) => /^\s*WITH\s+submitted/i.test(call.query)),
        entity
      ).toBe(false);

      const emptyState = createPaginationDb();
      const accepted = await worker.fetch(
        request(`/api/admin/${entity}/order`, {
          method: "PUT",
          role: "admin",
          body: JSON.stringify({ items: [] })
        }),
        { ...baseEnv, DB: emptyState.db }
      );
      const acceptedBody = await jsonBody(accepted);

      expect(accepted.status, `empty ${entity}`).toBe(200);
      expect(accepted.headers.get("Cache-Control"), `empty ${entity}`).toBe("no-store");
      expect(acceptedBody.items, `empty ${entity}`).toEqual([]);
      expect(
        emptyState.calls.some((call) => /^\s*WITH\s+submitted/i.test(call.query)),
        entity
      ).toBe(false);
    }
  });

  it("keeps complete-set and stale-revision protection for every ordering collection", async () => {
    for (const entity of ["documents", "menu", "carousel", "external-services"]) {
      const state = createPaginationDb(twoOrderRows(entity));
      const env = { ...baseEnv, DB: state.db };
      const table = orderTable(entity);
      const completeItems = reorderedCompactItems(entity, state.tables);
      const complete = await worker.fetch(
        request(`/api/admin/${entity}/order`, {
          method: "PUT",
          role: "admin",
          body: JSON.stringify({ items: completeItems })
        }),
        env
      );

      expect(complete.status, `complete ${entity}`).toBe(200);
      expect(
        state.tables[table].every((row) => row.revision === 1),
        `revisions ${entity}`
      ).toBe(true);
      const afterComplete = JSON.stringify(state.tables[table]);

      const stale = await worker.fetch(
        request(`/api/admin/${entity}/order`, {
          method: "PUT",
          role: "admin",
          body: JSON.stringify({ items: completeItems })
        }),
        env
      );
      const incompleteItems = compactOrderItems(entity, state.tables).slice(0, 1);
      const incomplete = await worker.fetch(
        request(`/api/admin/${entity}/order`, {
          method: "PUT",
          role: "admin",
          body: JSON.stringify({ items: incompleteItems })
        }),
        env
      );

      expect(stale.status, `stale ${entity}`).toBe(409);
      expect(stale.headers.get("Cache-Control"), `stale ${entity}`).toBe("no-store");
      await expect(jsonBody(stale)).resolves.toMatchObject({ resource: `${entity}-order` });
      expect(incomplete.status, `incomplete ${entity}`).toBe(409);
      expect(incomplete.headers.get("Cache-Control"), `incomplete ${entity}`).toBe("no-store");
      await expect(jsonBody(incomplete)).resolves.toMatchObject({ resource: `${entity}-order` });
      expect(JSON.stringify(state.tables[table]), `protected ${entity}`).toBe(afterComplete);
    }
  });

  it("uses COUNT plus LIMIT/OFFSET, returns metadata, clamps pages, and caps page size", async () => {
    const rows = Array.from({ length: 121 }, (_, index) => contentRow(index));
    const state = createPaginationDb({ contents: rows });
    const env = { ...baseEnv, DB: state.db };
    const pageResponse = await worker.fetch(request("/api/admin/content?page=2&pageSize=25"), env);
    const pageBody = await jsonBody(pageResponse);
    const clampedResponse = await worker.fetch(request("/api/admin/content?page=99&pageSize=25"), env);
    const clampedBody = await jsonBody(clampedResponse);
    const cappedResponse = await worker.fetch(request("/api/admin/content?pageSize=999"), env);
    const cappedBody = await jsonBody(cappedResponse);

    expect(pageResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(pageBody.items as Row[]).toHaveLength(25);
    expect(pageBody.pagination).toEqual({
      page: 2,
      pageSize: 25,
      totalItems: 121,
      totalPages: 5,
      hasPreviousPage: true,
      hasNextPage: true
    });
    expect(clampedBody.pagination).toMatchObject({ page: 5, totalPages: 5, hasNextPage: false });
    expect(clampedBody.items as Row[]).toHaveLength(21);
    expect(cappedBody.pagination).toMatchObject({ page: 1, pageSize: 100, totalPages: 2 });
    expect(cappedBody.items as Row[]).toHaveLength(100);
    expect(state.calls.some((call) => /COUNT\(\*\) AS total FROM contents/i.test(call.query))).toBe(true);
    expect(
      state.calls.some(
        (call) => /LIMIT \? OFFSET \?/i.test(call.query) && call.bindings.at(-2) === 25 && call.bindings.at(-1) === 25
      )
    ).toBe(true);
  });

  it("normalizes invalid pagination and executes bound search/filter values in SQL", async () => {
    const state = createPaginationDb({
      contents: [
        contentRow(1, { title: "ITA report", status: "published", category: "ita" }),
        contentRow(2, { title: "Other", status: "draft", category: "general" })
      ]
    });
    const env = { ...baseEnv, DB: state.db };
    const response = await worker.fetch(
      request("/api/admin/content?page=-8&pageSize=bad&q=ITA&status=published&category=ita"),
      env
    );
    const body = await jsonBody(response);
    const itemQuery = state.calls.find(
      (call) => /FROM contents/i.test(call.query) && /LIMIT \? OFFSET \?/i.test(call.query)
    );

    expect(body.pagination).toMatchObject({ page: 1, pageSize: 25, totalItems: 1 });
    expect(body.items).toEqual([expect.objectContaining({ title: "ITA report", status: "published" })]);
    expect(itemQuery?.query).toMatch(/LIKE \? ESCAPE/);
    expect(itemQuery?.query).toMatch(/status = \?/);
    expect(itemQuery?.query).not.toContain("ITA");
    expect(itemQuery?.bindings).toContain("%ITA%");
    expect(itemQuery?.bindings).toContain("published");

    const tagsState = createPaginationDb({
      contents: [contentRow(3, { title: "No title match", tags_json: '["agri-tag"]' })]
    });
    const tagsResponse = await worker.fetch(request("/api/admin/content?q=agri-tag"), { ...baseEnv, DB: tagsState.db });
    const tagsBody = await jsonBody(tagsResponse);
    const tagsQuery = tagsState.calls.find(
      (call) => /FROM contents/i.test(call.query) && /LIMIT \? OFFSET \?/i.test(call.query)
    );

    expect(tagsBody.items).toEqual([expect.objectContaining({ id: "content-003" })]);
    expect(tagsQuery?.query).toMatch(/tags_json LIKE \? ESCAPE/);
    expect(tagsQuery?.bindings).toContain("%agri-tag%");
  });

  it("keeps manual document order within pinned groups for default and pinned sorts", async () => {
    const state = createPaginationDb({
      documents: [
        documentRow("pinned-a", { pinned: 1, sort_order: 30 }),
        documentRow("pinned-z", { pinned: 1, sort_order: 10 }),
        documentRow("pinned-m", { pinned: 1, sort_order: 20 }),
        documentRow("regular", { pinned: 0, sort_order: 1 })
      ]
    });
    const env = { ...baseEnv, DB: state.db };
    const defaultBody = await jsonBody(await worker.fetch(request("/api/admin/documents"), env));
    const pinnedBody = await jsonBody(
      await worker.fetch(request("/api/admin/documents?sortBy=pinned&sortDirection=desc"), env)
    );
    const itemQueries = state.calls.filter(
      (call) => /FROM documents/i.test(call.query) && /LIMIT \? OFFSET \?/i.test(call.query)
    );

    expect((defaultBody.items as Row[]).map((row) => row.id)).toEqual(["pinned-z", "pinned-m", "pinned-a", "regular"]);
    expect((pinnedBody.items as Row[]).map((row) => row.id)).toEqual(["pinned-z", "pinned-m", "pinned-a", "regular"]);
    expect(itemQueries).toHaveLength(2);
    expect(itemQueries.every((call) => /ORDER BY pinned DESC, sort_order ASC/i.test(call.query))).toBe(true);
  });

  it("normalizes unsupported sorts, binds injection strings, escapes LIKE wildcards, and excludes heavy content", async () => {
    const attack = "' OR 1=1 --";
    const state = createPaginationDb({
      contents: [contentRow(1, { title: "100% complete" }), contentRow(2, { title: "Ordinary" })]
    });
    const env = { ...baseEnv, DB: state.db };
    const injectionResponse = await worker.fetch(
      request(
        `/api/admin/content?q=${encodeURIComponent(attack)}&sortBy=${encodeURIComponent("title; DROP TABLE contents")}`
      ),
      env
    );
    const injectionBody = await jsonBody(injectionResponse);
    const wildcardResponse = await worker.fetch(request("/api/admin/content?q=%25"), env);
    const wildcardBody = await jsonBody(wildcardResponse);
    const itemQueries = state.calls.filter(
      (call) => /FROM contents/i.test(call.query) && /LIMIT \? OFFSET \?/i.test(call.query)
    );

    expect(injectionBody.items).toEqual([]);
    expect(itemQueries[0]?.query).toMatch(/ORDER BY updated_at DESC, id ASC/);
    expect(itemQueries[0]?.query).not.toContain(attack);
    expect(itemQueries[0]?.query).not.toContain("DROP TABLE");
    expect(wildcardBody.items).toEqual([expect.objectContaining({ title: "100% complete" })]);
    expect(itemQueries[1]?.bindings).toContain("%\\%%");
    expect(itemQueries[1]?.query).not.toContain("body_snapshot");
    expect((wildcardBody.items as Row[])[0]).not.toHaveProperty("body");
    expect((wildcardBody.items as Row[])[0]).toMatchObject({ template: "standard", canonicalUrl: "" });
  });

  it("serves every required entity list with the shared contract and media's 24-item default", async () => {
    const state = createPaginationDb(allEntityRows());
    const env = { ...baseEnv, DB: state.db };
    const entities = ["content", "documents", "media", "events", "users", "carousel", "external-services", "menu"];

    for (const entity of entities) {
      const response = await worker.fetch(request(`/api/admin/${entity}`), env);
      const body = await jsonBody(response);

      expect(response.status, entity).toBe(200);
      expect(response.headers.get("Cache-Control"), entity).toBe("no-store");
      expect(body, entity).toMatchObject({
        items: [expect.any(Object)],
        pagination: { page: 1, pageSize: entity === "media" ? 24 : 25, totalItems: 1, totalPages: 1 }
      });
    }

    const menu = await jsonBody(await worker.fetch(request("/api/admin/menu"), env));
    expect(menu.items).toEqual([
      expect.objectContaining({ id: "menu-1", parentId: null, label: "Home", order: 0, revision: 0 })
    ]);

    const eventList = await jsonBody(await worker.fetch(request("/api/admin/events"), env));

    expect(eventList.items).toEqual([
      expect.objectContaining({
        id: "event-1",
        mediaIds: ["media-1"]
      })
    ]);

    const eventItemQuery = state.calls.find(
      (call) => /FROM events/i.test(call.query) && /LIMIT \? OFFSET \?/i.test(call.query)
    );

    expect(eventItemQuery?.query).toMatch(/SELECT[\s\S]*media_ids_json[\s\S]*FROM events/i);

    expect(eventItemQuery?.query).toMatch(/ORDER BY date DESC/i);

    const expectedOrderKeys: Record<string, string[]> = {
      documents: ["id", "order", "pinned", "revision", "title"],
      menu: ["enabled", "id", "label", "order", "parentId", "revision"],
      carousel: ["enabled", "id", "order", "revision", "title"],
      "external-services": ["enabled", "id", "order", "revision", "title"]
    };

    for (const [entity, keys] of Object.entries(expectedOrderKeys)) {
      const orderBody = await jsonBody(await worker.fetch(request(`/api/admin/${entity}/order`), env));
      expect(Object.keys((orderBody.items as Row[])[0] ?? {}).sort(), entity).toEqual(keys);
    }

    await worker.fetch(request("/api/admin/media?q=image"), env);
    const mediaSearchQuery = state.calls.find(
      (call) =>
        /FROM media_assets/i.test(call.query) && /LIMIT \? OFFSET \?/i.test(call.query) && /LIKE \?/i.test(call.query)
    );
    expect(mediaSearchQuery?.query).toMatch(/type LIKE \? ESCAPE/);
    expect(mediaSearchQuery?.bindings).toContain("%image%");

    await worker.fetch(request("/api/admin/documents?q=files.example.invalid"), env);
    const documentSearchQuery = state.calls.find(
      (call) =>
        /FROM documents/i.test(call.query) && /LIMIT \? OFFSET \?/i.test(call.query) && /LIKE \?/i.test(call.query)
    );
    expect(documentSearchQuery?.query).toMatch(/file_url LIKE \? ESCAPE/);
    expect(documentSearchQuery?.bindings).toContain("%files.example.invalid%");
  });

  it("preserves and normalizes responsive carousel fields in paginated admin lists", async () => {
    const baseCarouselRow = allEntityRows().carousel_slides[0] as Row;
    const state = createPaginationDb({
      carousel_slides: [
        {
          ...baseCarouselRow,
          id: "slide-valid",
          title: "Responsive slide",
          subtitle: "Responsive subtitle",
          chip: "Featured",
          image_alt: "Responsive image",
          button_label: "Read more",
          href: "/responsive",
          image_fit: "fill",
          focal_point_x: 35.5,
          focal_point_y: 0,
          mobile_image_url: " https://images.example.test/mobile.jpg ",
          background_color: "#ABCDEF",
          open_in_new_tab: 1,
          sort_order: 1,
          start_at: "2026-07-14T00:00:00.000Z",
          end_at: "2026-08-14T00:00:00.000Z",
          revision: 3
        },
        {
          ...baseCarouselRow,
          id: "slide-invalid",
          title: "Invalid responsive values",
          image_fit: "invalid",
          focal_point_x: -10,
          focal_point_y: "140",
          mobile_image_url: null,
          background_color: "expression(alert(1))",
          open_in_new_tab: 0,
          enabled: 0,
          sort_order: 2,
          revision: 4
        },
        {
          ...baseCarouselRow,
          id: "slide-numeric-string",
          title: "Numeric string focal point",
          image_fit: "fit",
          focal_point_x: "75",
          focal_point_y: "bad",
          mobile_image_url: 42,
          background_color: " #AbC ",
          open_in_new_tab: 2,
          sort_order: 3,
          revision: 5
        },
        {
          ...baseCarouselRow,
          id: "slide-legacy",
          title: "Legacy slide",
          sort_order: 4,
          revision: 6
        }
      ]
    });
    const response = await worker.fetch(request("/api/admin/carousel"), { ...baseEnv, DB: state.db });
    const body = await jsonBody(response);
    const items = body.items as Row[];
    const itemQuery = state.calls.find(
      (call) => /FROM carousel_slides/i.test(call.query) && /LIMIT \? OFFSET \?/i.test(call.query)
    );
    const selectedColumns =
      itemQuery?.query
        .match(/SELECT\s+([\s\S]*?)\s+FROM\s+carousel_slides/i)?.[1]
        ?.split(",")
        .map((column) => column.trim()) ?? [];

    expect(response.status).toBe(200);
    expect(selectedColumns).toEqual([
      "id",
      "title",
      "subtitle",
      "chip",
      "image_url",
      "image_alt",
      "button_label",
      "href",
      "image_fit",
      "focal_point_x",
      "focal_point_y",
      "mobile_image_url",
      "background_color",
      "open_in_new_tab",
      "enabled",
      "sort_order",
      "start_at",
      "end_at",
      "updated_at",
      "revision"
    ]);
    expect(items).toHaveLength(4);
    expect(items[0]).toEqual({
      id: "slide-valid",
      title: "Responsive slide",
      subtitle: "Responsive subtitle",
      chip: "Featured",
      imageUrl: "https://images.example.invalid/slide.jpg",
      imageAlt: "Responsive image",
      buttonLabel: "Read more",
      href: "/responsive",
      imageFit: "fill",
      focalPointX: 35.5,
      focalPointY: 0,
      mobileImageUrl: "https://images.example.test/mobile.jpg",
      backgroundColor: "#abcdef",
      openInNewTab: true,
      enabled: true,
      order: 1,
      startAt: "2026-07-14T00:00:00.000Z",
      endAt: "2026-08-14T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      revision: 3
    });
    expect(items[1]).toMatchObject({
      id: "slide-invalid",
      imageFit: "fit-blur",
      focalPointX: 0,
      focalPointY: 100,
      mobileImageUrl: "",
      backgroundColor: "",
      openInNewTab: false,
      enabled: false,
      order: 2,
      revision: 4
    });
    expect(items[2]).toMatchObject({
      id: "slide-numeric-string",
      imageFit: "fit",
      focalPointX: 75,
      focalPointY: 50,
      mobileImageUrl: "42",
      backgroundColor: "#abc",
      openInNewTab: false,
      revision: 5
    });
    expect(items[3]).toMatchObject({
      id: "slide-legacy",
      imageFit: "fit-blur",
      focalPointX: 50,
      focalPointY: 50,
      mobileImageUrl: "",
      backgroundColor: "",
      openInNewTab: false,
      revision: 6
    });

    for (const item of items) {
      for (const field of [
        "image_fit",
        "focal_point_x",
        "focal_point_y",
        "mobile_image_url",
        "background_color",
        "open_in_new_tab"
      ]) {
        expect(item).not.toHaveProperty(field);
      }
    }
  });

  it("returns bounded media ID lookups in request order", async () => {
    const assets = ["a", "b", "c"].map((id) => ({
      ...(allEntityRows().media_assets[0] as Row),
      id,
      name: id.toUpperCase()
    }));
    const state = createPaginationDb({ media_assets: assets });
    const env = { ...baseEnv, DB: state.db };
    const response = await worker.fetch(request("/api/admin/media/by-ids?ids=c,a,c,missing"), env);
    const body = await jsonBody(response);
    const overflow = Array.from({ length: 51 }, (_, index) => `id-${index}`).join(",");
    const overflowResponse = await worker.fetch(request(`/api/admin/media/by-ids?ids=${overflow}`), env);

    expect((body.items as Row[]).map((item) => item.id)).toEqual(["c", "a"]);
    expect(overflowResponse.status).toBe(400);
    await expect(jsonBody(overflowResponse)).resolves.toMatchObject({ maximumIds: 50 });
  });

  it("returns compact ordering rows and saves a revision-safe order without replacing heavy fields", async () => {
    const state = createPaginationDb({
      documents: [documentRow("document-a", { sort_order: 1 }), documentRow("document-b", { sort_order: 2 })]
    });
    const env = { ...baseEnv, DB: state.db };
    const initial = await jsonBody(await worker.fetch(request("/api/admin/documents/order"), env));
    const saveResponse = await worker.fetch(
      request("/api/admin/documents/order", {
        method: "PUT",
        role: "editor",
        body: JSON.stringify({
          items: [
            { id: "document-a", order: 2, pinned: false, revision: 0 },
            { id: "document-b", order: 1, pinned: true, revision: 0 }
          ]
        })
      }),
      env
    );
    const saved = await jsonBody(saveResponse);
    const descriptions = state.tables.documents.map((row) => row.description);
    const beforeStale = JSON.stringify(state.tables.documents);
    const staleResponse = await worker.fetch(
      request("/api/admin/documents/order", {
        method: "PUT",
        role: "editor",
        body: JSON.stringify({
          items: [
            { id: "document-a", order: 9, pinned: true, revision: 0 },
            { id: "document-b", order: 8, pinned: false, revision: 0 }
          ]
        })
      }),
      env
    );
    const incompleteResponse = await worker.fetch(
      request("/api/admin/documents/order", {
        method: "PUT",
        role: "editor",
        body: JSON.stringify({ items: [{ id: "document-a", order: 1, pinned: false, revision: 1 }] })
      }),
      env
    );
    const duplicateOrderResponse = await worker.fetch(
      request("/api/admin/documents/order", {
        method: "PUT",
        role: "editor",
        body: JSON.stringify({
          items: [
            { id: "document-a", order: 1, pinned: false, revision: 1 },
            { id: "document-b", order: 1, pinned: false, revision: 1 }
          ]
        })
      }),
      env
    );

    expect(initial.items).toEqual([
      { id: "document-a", title: "Document document-a", order: 1, pinned: false, revision: 0 },
      { id: "document-b", title: "Document document-b", order: 2, pinned: false, revision: 0 }
    ]);
    expect(saveResponse.status).toBe(200);
    expect(saved.items).toEqual([
      { id: "document-b", title: "Document document-b", order: 1, pinned: true, revision: 1 },
      { id: "document-a", title: "Document document-a", order: 2, pinned: false, revision: 1 }
    ]);
    expect(descriptions).toEqual([
      "Description that must survive compact ordering",
      "Description that must survive compact ordering"
    ]);
    expect(staleResponse.status).toBe(409);
    expect(incompleteResponse.status).toBe(409);
    expect(duplicateOrderResponse.status).toBe(400);
    expect(JSON.stringify(state.tables.documents)).toBe(beforeStale);
    const updateCall = state.calls.find((call) => /^\s*WITH\s+submitted/i.test(call.query));
    expect(updateCall?.query).toMatch(/valid_submission/);
    expect(updateCall?.query).toMatch(/revision = revision \+ 1/);
    expect(updateCall?.query).not.toContain("document-a");
  });

  it("supports revision-safe flat menu CRUD while rejecting parent deletion and non-admin writes", async () => {
    const state = createPaginationDb({
      menu_items: [
        {
          ...(allEntityRows().menu_items[0] as Row),
          id: "root",
          label: "Root"
        },
        {
          ...(allEntityRows().menu_items[0] as Row),
          id: "existing-child",
          parent_id: "root",
          label: "Existing child"
        }
      ]
    });
    const env = { ...baseEnv, DB: state.db };
    const denied = await worker.fetch(
      request("/api/admin/menu", {
        method: "POST",
        role: "editor",
        body: JSON.stringify({ label: "Denied", href: "/denied" })
      }),
      env
    );
    const createdResponse = await worker.fetch(
      request("/api/admin/menu", {
        method: "POST",
        body: JSON.stringify({ id: "new-child", label: "New child", href: "/new", parentId: "root", order: 2 })
      }),
      env
    );
    const created = await jsonBody(createdResponse);
    const patchedResponse = await worker.fetch(
      request("/api/admin/menu/new-child", {
        method: "PATCH",
        headers: { "X-RCAT-Expected-Revision": "0" },
        body: JSON.stringify({ label: "Renamed child", parentId: null })
      }),
      env
    );
    const patched = await jsonBody(patchedResponse);
    const staleResponse = await worker.fetch(
      request("/api/admin/menu/new-child", {
        method: "PATCH",
        headers: { "X-RCAT-Expected-Revision": "0" },
        body: JSON.stringify({ label: "Stale name" })
      }),
      env
    );
    const parentDelete = await worker.fetch(
      request("/api/admin/menu/root", {
        method: "DELETE",
        headers: { "X-RCAT-Expected-Revision": "0" }
      }),
      env
    );
    const childDelete = await worker.fetch(
      request("/api/admin/menu/new-child", {
        method: "DELETE",
        headers: { "X-RCAT-Expected-Revision": "1" }
      }),
      env
    );

    expect(denied.status).toBe(403);
    expect(createdResponse.status).toBe(201);
    expect(created).toMatchObject({
      item: { id: "new-child", parentId: "root", label: "New child", href: "/new", order: 2, revision: 0 }
    });
    expect(patchedResponse.status).toBe(200);
    expect(patched).toMatchObject({
      item: { id: "new-child", parentId: null, label: "Renamed child", href: "/new", revision: 1 }
    });
    expect(staleResponse.status).toBe(409);
    expect(parentDelete.status).toBe(409);
    await expect(jsonBody(parentDelete)).resolves.toMatchObject({ error: "menu item has children" });
    expect(childDelete.status).toBe(200);
    expect(state.tables.menu_items.some((row) => row.id === "new-child")).toBe(false);
  });

  it("returns aggregate visitor settings and a bounded dashboard summary", async () => {
    const bangkokNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const today = bangkokNow.toISOString().slice(0, 10);
    const yesterdayDate = new Date(bangkokNow);
    yesterdayDate.setUTCDate(bangkokNow.getUTCDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);
    const state = createPaginationDb({
      ...allEntityRows(),
      visitor_daily_stats: [
        {
          day: today,
          total_views: 10,
          unique_visitors: 4,
          online_users: 2,
          updated_at: "2026-07-12T01:00:00.000Z"
        },
        {
          day: yesterday,
          total_views: 8,
          unique_visitors: 3,
          online_users: 0,
          updated_at: "2026-07-11T01:00:00.000Z"
        }
      ]
    });
    const env = { ...baseEnv, DB: state.db };
    const statsResponse = await worker.fetch(request("/api/admin/visitor-stats/summary"), env);
    const stats = await jsonBody(statsResponse);
    const dashboardResponse = await worker.fetch(request("/api/admin/dashboard-summary"), env);
    const dashboard = await jsonBody(dashboardResponse);

    expect(statsResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(stats).toEqual({
      enabled: true,
      usersToday: 4,
      usersYesterday: 3,
      usersThisMonth: 7,
      usersThisYear: 7,
      totalUsers: 7,
      totalViews: 18,
      onlineUsers: 2,
      updatedAt: "2026-07-12T01:00:00.000Z"
    });
    expect(dashboardResponse.status).toBe(200);
    expect(dashboard).toMatchObject({
      counts: {
        content: { total: 1, draft: 1 },
        documents: { total: 1, draft: 1 },
        media: { total: 1 }
      },
      recentContent: [expect.objectContaining({ id: "content-001" })],
      documents: [expect.objectContaining({ id: "document-1" })]
    });
    expect((dashboard.recentContent as Row[])[0]).not.toHaveProperty("body");
  });
});
