import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteAdminMenuItem,
  getAdminContentList,
  getAdminMediaByIds,
  getAdminMediaList,
  getAdminVisitorStatsSummary,
  publishAllPendingAdminContent,
  saveAdminDocumentOrder,
  saveAdminMenuItem
} from "./api";
import { ADMIN_MEDIA_BY_IDS_MAX } from "./types";
import { CMS_CSRF_COOKIE_NAME } from "../cms-auth";

const CMS_CSRF_TOKEN = "P".repeat(43);

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

function getProxiedPath(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0) {
  const requestUrl = String(fetchMock.mock.calls[callIndex]?.[0]);
  return new URL(requestUrl, "https://admin.example.test").searchParams.get("path");
}

describe("admin pagination API client", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_CLOUDFLARE_ADMIN_PROXY_URL", "/api/admin-proxy");
    vi.spyOn(Document.prototype, "cookie", "get").mockReturnValue(`${CMS_CSRF_COOKIE_NAME}=${CMS_CSRF_TOKEN}`);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("normalizes pagination and forwards server-side search and filters through the authenticated proxy", async () => {
    const payload = {
      items: [{ id: "content-1", title: "ITA" }],
      pagination: {
        page: 2,
        pageSize: 100,
        totalItems: 101,
        totalPages: 2,
        hasPreviousPage: true,
        hasNextPage: false
      },
      generatedAt: "2026-07-12T00:00:00.000Z"
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getAdminContentList({
        page: 2,
        pageSize: 1_000,
        q: "  ita  ",
        status: "published",
        sortBy: "updatedAt",
        sortDirection: "desc"
      })
    ).resolves.toEqual(payload);

    const proxiedPath = getProxiedPath(fetchMock);
    const url = new URL(proxiedPath ?? "", "https://worker.example.test");
    expect(url.pathname).toBe("/api/admin/content");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      page: "2",
      pageSize: "100",
      q: "ita",
      status: "published",
      sortBy: "updatedAt",
      sortDirection: "desc"
    });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: "include" });
  });

  it("uses the media page-size default", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [],
        pagination: {
          page: 1,
          pageSize: 24,
          totalItems: 0,
          totalPages: 0,
          hasPreviousPage: false,
          hasNextPage: false
        },
        generatedAt: "2026-07-12T00:00:00.000Z"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await getAdminMediaList({ type: "image" });

    const url = new URL(getProxiedPath(fetchMock) ?? "", "https://worker.example.test");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("pageSize")).toBe("24");
    expect(url.searchParams.get("type")).toBe("image");
  });

  it("deduplicates bounded media id lookups and skips an empty lookup", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ items: [{ id: "media-1" }, { id: "media-2" }], generatedAt: "2026-07-12T00:00:00.000Z" })
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAdminMediaByIds([])).resolves.toEqual([]);
    await expect(getAdminMediaByIds([" media-1 ", "media-1", "media-2"])).resolves.toEqual([
      { id: "media-1" },
      { id: "media-2" }
    ]);

    const url = new URL(getProxiedPath(fetchMock) ?? "", "https://worker.example.test");
    expect(url.pathname).toBe("/api/admin/media/by-ids");
    expect(url.searchParams.get("ids")).toBe("media-1,media-2");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an unbounded media id lookup before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const ids = Array.from({ length: ADMIN_MEDIA_BY_IDS_MAX + 1 }, (_, index) => `media-${index}`);

    await expect(getAdminMediaByIds(ids)).rejects.toThrow(`maximum of ${ADMIN_MEDIA_BY_IDS_MAX}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saves compact ordering rows with their revisions", async () => {
    const items = [{ id: "document-1", title: "คำสั่ง", order: 1, pinned: false, revision: 7 }];
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items,
        generatedAt: "2026-07-12T00:00:00.000Z"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveAdminDocumentOrder(items)).resolves.toEqual(items);
    expect(getProxiedPath(fetchMock)).toBe("/api/admin/documents/order");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({
        items: [{ id: "document-1", order: 1, pinned: false, revision: 7 }]
      })
    });
  });

  it("writes and deletes individual menu items with revision protection", async () => {
    const savedItem = {
      id: "menu-1",
      parentId: "",
      label: "ข่าวสาร",
      href: "/news",
      enabled: true,
      order: 1,
      updatedAt: "2026-07-12T00:00:00.000Z",
      revision: 4
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ item: savedItem }))
      .mockResolvedValueOnce(jsonResponse({ id: "menu-1", deleted: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveAdminMenuItem(savedItem)).resolves.toEqual(savedItem);
    await expect(deleteAdminMenuItem(savedItem)).resolves.toEqual({ id: "menu-1", deleted: true });

    expect(getProxiedPath(fetchMock, 0)).toBe("/api/admin/menu/menu-1");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "PATCH" });
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("X-RCAT-Expected-Revision")).toBe("4");
    expect(getProxiedPath(fetchMock, 1)).toBe("/api/admin/menu/menu-1");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "DELETE" });
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("X-RCAT-Expected-Revision")).toBe("4");
  });

  it("loads visitor totals and publishes the pending queue without fetching every content id", async () => {
    const visitorSummary = {
      enabled: true,
      usersToday: 12,
      usersYesterday: 10,
      usersThisMonth: 120,
      usersThisYear: 900,
      totalUsers: 800,
      totalViews: 1_200,
      onlineUsers: 3,
      updatedAt: "2026-07-12T00:00:00.000Z"
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(visitorSummary))
      .mockResolvedValueOnce(jsonResponse({ publishedCount: 4 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAdminVisitorStatsSummary()).resolves.toEqual(visitorSummary);
    await expect(publishAllPendingAdminContent()).resolves.toEqual({ publishedCount: 4 });

    expect(getProxiedPath(fetchMock, 0)).toBe("/api/admin/visitor-stats/summary");
    expect(getProxiedPath(fetchMock, 1)).toBe("/api/admin/content/publish-pending");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "POST", body: "{}" });
  });
});
