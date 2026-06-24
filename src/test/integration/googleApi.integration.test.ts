import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/projectSettings", () => ({
  getGoogleAppsScriptUrl: () => "https://script.google.com/macros/s/test/exec",
  projectSettings: {
    api: {
      googleAppsScriptUrl: "https://script.google.com/macros/s/test/exec",
      googleAppsScriptUrlEnv: "VITE_GOOGLE_APPS_SCRIPT_URL",
      resources: {
        snapshot: "snapshot",
        adminSnapshot: "snapshot-admin",
        health: "health",
        content: "content",
        contentDetail: "content-detail",
        adminContentDetail: "content-detail-admin",
        contentView: "content-view",
        publicDocumentList: "public-document-list",
        document: "document",
        deleteDocument: "document-delete",
        deleteContent: "content-delete",
        carousel: "carousel",
        deleteCarousel: "carousel-delete",
        media: "media",
        deleteMedia: "media-delete",
        publish: "publish",
        menu: "menu",
        event: "event",
        deleteEvent: "event-delete",
        displaySettings: "display-settings",
        siteSettings: "site-settings",
        homepageSettings: "homepage-settings"
      }
    },
    storageKeys: {
      session: "rcat.cms.session",
      displaySettings: "rcat.cms.display.settings"
    }
  }
}));

import {
  deleteDocumentFromApi,
  getAdminCmsSnapshot,
  getCmsSnapshot,
  getPublicDocumentList,
  recordContentView,
  saveCalendarEvent,
  saveDocumentToApi,
  saveSiteSettingsToApi
} from "../../services/googleApi";

function createSnapshotResponse() {
  return new Response(
    JSON.stringify({
      metrics: [],
      content: [],
      media: [],
      events: [],
      menu: [],
      siteSettings: {
        siteName: "Public site",
        heroTitle: "Public site"
      },
      statusCode: 200
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function storeSessionToken(token: string) {
  window.localStorage.setItem(
    "rcat.cms.session",
    JSON.stringify({
      token,
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    })
  );
}

describe("googleApi integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("loads snapshot data from Apps Script", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSnapshotResponse());

    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await getCmsSnapshot();

    expect(snapshot.metrics).toEqual([]);
    expect(snapshot.content).toEqual([]);
    expect(snapshot.menu).toEqual([]);
    expect(snapshot.siteSettings?.siteName).toBe("Public site");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.searchParams.get("resource")).toBe("snapshot");
    expect(requestUrl.searchParams.has("authToken")).toBe(false);
    expect(requestUrl.searchParams.has("_ts")).toBe(false);
  });

  it("does not append authToken to authenticated GET request URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSnapshotResponse());
    storeSessionToken("url-token");

    vi.stubGlobal("fetch", fetchMock);

    await getCmsSnapshot();

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.searchParams.get("resource")).toBe("snapshot");
    expect(requestUrl.searchParams.has("authToken")).toBe(false);
    expect(requestUrl.searchParams.has("_ts")).toBe(false);
    expect(requestUrl.toString()).not.toContain("authToken");
  });

  it("sends admin snapshot authToken in POST body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSnapshotResponse());
    storeSessionToken("admin-token");

    vi.stubGlobal("fetch", fetchMock);

    await getAdminCmsSnapshot();

    const [requestUrl, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const parsedUrl = new URL(String(requestUrl));
    expect(parsedUrl.searchParams.get("resource")).toBe("snapshot-admin");
    expect(parsedUrl.searchParams.has("authToken")).toBe(false);
    expect(parsedUrl.searchParams.has("_ts")).toBe(false);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "text/plain;charset=utf-8"
    });
    expect(JSON.parse(String(init.body))).toEqual({
      authToken: "admin-token"
    });
  });

  it("sends site settings authToken in POST body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          siteName: "Updated public site",
          heroTitle: "Updated public site",
          statusCode: 200
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    storeSessionToken("admin-token");

    vi.stubGlobal("fetch", fetchMock);

    const saved = await saveSiteSettingsToApi({
      siteName: "Updated public site"
    });

    const [requestUrl, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const parsedUrl = new URL(String(requestUrl));
    expect(saved.siteName).toBe("Updated public site");
    expect(parsedUrl.searchParams.get("resource")).toBe("site-settings");
    expect(parsedUrl.searchParams.has("authToken")).toBe(false);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      siteName: "Updated public site",
      authToken: "admin-token"
    });
  });

  it("records content views without authToken", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "content-1",
          slug: "announcement-1",
          viewCount: 8,
          lastViewedAt: "2026-05-03T00:00:00.000Z",
          statusCode: 200
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    storeSessionToken("admin-token");

    vi.stubGlobal("fetch", fetchMock);

    const saved = await recordContentView({ slug: "announcement-1" });
    const [requestUrl, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const parsedUrl = new URL(String(requestUrl));

    expect(saved.viewCount).toBe(8);
    expect(parsedUrl.searchParams.get("resource")).toBe("content-view");
    expect(parsedUrl.searchParams.has("authToken")).toBe(false);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      slug: "announcement-1"
    });
  });

  it("loads public document lists with a cache-friendly GET", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "document-1",
              title: "Public document",
              fileUrl: "https://example.edu/document.pdf",
              publishedAt: "2026-05-03T00:00:00.000Z",
              order: 1,
              pinned: true,
              updatedAt: "2026-05-03T00:00:00.000Z"
            }
          ],
          generatedAt: "2026-05-03T00:00:00.000Z",
          statusCode: 200
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    storeSessionToken("admin-token");

    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await getPublicDocumentList();
    const [requestUrl, init] = fetchMock.mock.calls[0] as [URL, RequestInit | undefined];
    const parsedUrl = new URL(String(requestUrl));

    expect(snapshot.items.map((item) => item.id)).toEqual(["document-1"]);
    expect(parsedUrl.searchParams.get("resource")).toBe("public-document-list");
    expect(parsedUrl.searchParams.has("_ts")).toBe(false);
    expect(parsedUrl.searchParams.has("authToken")).toBe(false);
    expect(init?.cache).toBeUndefined();
  });

  it("sends document save and delete authToken in POST bodies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "document-1",
            title: "Public document",
            fileUrl: "https://example.edu/document.pdf",
            status: "published",
            order: 1,
            pinned: false,
            updatedAt: "2026-05-03T00:00:00.000Z",
            statusCode: 200
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "document-1",
            deleted: true,
            statusCode: 200
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    storeSessionToken("editor-token");

    vi.stubGlobal("fetch", fetchMock);

    await saveDocumentToApi({
      id: "document-1",
      title: "Public document",
      description: "Downloadable file",
      category: "Policy",
      fileUrl: "https://example.edu/document.pdf",
      status: "published",
      order: 1,
      pinned: false
    });
    await deleteDocumentFromApi("document-1");

    const [saveUrl, saveInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[1] as [URL, RequestInit];

    expect(new URL(String(saveUrl)).searchParams.get("resource")).toBe("document");
    expect(JSON.parse(String(saveInit.body))).toMatchObject({
      id: "document-1",
      title: "Public document",
      authToken: "editor-token"
    });
    expect(new URL(String(deleteUrl)).searchParams.get("resource")).toBe("document-delete");
    expect(JSON.parse(String(deleteInit.body))).toEqual({
      id: "document-1",
      authToken: "editor-token"
    });
  });

  it("surfaces backend validation errors for event saves", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "End date must be the same as or after the start date.",
          statusCode: 400
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveCalendarEvent({
        title: "Invalid event",
        date: "2026-05-01T12:00:00.000Z",
        endDate: "2026-05-01T09:00:00.000Z",
        audience: "Students",
        status: "confirmed"
      })
    ).rejects.toThrow("End date must be the same as or after the start date.");
  });
});
