import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem } from "../public-content/types";
import type { CmsDocumentItem } from "../cms-documents/types";

const googleApiMocks = vi.hoisted(() => ({
  deleteContentItem: vi.fn(),
  deleteCalendarEvent: vi.fn(),
  deleteCarouselSlideFromApi: vi.fn(),
  deleteDocumentFromApi: vi.fn(),
  deleteExternalServiceLinkFromApi: vi.fn(),
  getAdminCmsSnapshot: vi.fn(),
  getAdminContentDetail: vi.fn(),
  getDisplaySettingsFromApi: vi.fn(),
  getPublicMenuItems: vi.fn(),
  publishContent: vi.fn(),
  saveCalendarEvent: vi.fn(),
  saveCarouselSlideToApi: vi.fn(),
  saveContentItem: vi.fn(),
  saveDisplaySettingsToApi: vi.fn(),
  saveDocumentToApi: vi.fn(),
  saveExternalServiceLinkToApi: vi.fn(),
  saveHomepageSettingsToApi: vi.fn(),
  savePublicMenuItems: vi.fn(),
  saveSiteSettingsToApi: vi.fn(),
  saveVisitorStatsToApi: vi.fn(),
  saveMediaAsset: vi.fn(),
  uploadMediaAsset: vi.fn(),
  deleteMediaAsset: vi.fn()
}));

vi.mock("../../services/googleApi", () => googleApiMocks);

const sampleContent: ContentItem = {
  id: "m18-preview-content-001",
  title: "M18 preview content",
  slug: "m18-preview-content",
  type: "news",
  status: "draft",
  owner: "preview-editor",
  summary: "Fake preview content only.",
  body: "Fake preview body.",
  category: "sample",
  tags: ["m18"],
  featured: false,
  mediaIds: ["m18-preview-media-001"],
  updatedAt: "2026-06-16T00:00:00.000Z",
  publishAt: "2026-06-16T00:00:00.000Z"
};

const sampleDocument: CmsDocumentItem = {
  id: "m18-preview-document-001",
  title: "M18 preview document",
  description: "Fake preview document only.",
  category: "sample",
  fileUrl: "https://files.example.test/m18-preview-document.pdf",
  fileName: "m18-preview-document.pdf",
  mediaId: "m18-preview-media-001",
  publishedAt: "",
  order: 1,
  pinned: false,
  updatedAt: "2026-06-16T00:00:00.000Z",
  status: "draft"
};

function setAppsScriptEnv() {
  vi.stubEnv("VITE_BACKEND_MIGRATION_MODE", "");
  vi.stubEnv("VITE_ADMIN_WRITE_PROVIDER", "");
  vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "");
  vi.stubEnv("VITE_CLOUDFLARE_ADMIN_API_URL", "");
  vi.stubEnv("VITE_CLOUDFLARE_ADMIN_AUTH_MODE", "");
  vi.stubEnv("VITE_CLOUDFLARE_ADMIN_PROXY_URL", "");
}

function setCloudflareEnv() {
  vi.stubEnv("VITE_BACKEND_MIGRATION_MODE", "cloudflare-first-preview");
  vi.stubEnv("VITE_ADMIN_WRITE_PROVIDER", "cloudflare");
  vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://preview-worker.example.test");
  vi.stubEnv("VITE_CLOUDFLARE_ADMIN_API_URL", "");
  vi.stubEnv("VITE_CLOUDFLARE_ADMIN_AUTH_MODE", "cloudflare-access");
  vi.stubEnv("VITE_CLOUDFLARE_ADMIN_PROXY_URL", "");
}

function setServerProxyEnv() {
  vi.stubEnv("VITE_BACKEND_MIGRATION_MODE", "cloudflare-first-preview");
  vi.stubEnv("VITE_ADMIN_WRITE_PROVIDER", "cloudflare");
  vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "");
  vi.stubEnv("VITE_CLOUDFLARE_ADMIN_API_URL", "");
  vi.stubEnv("VITE_CLOUDFLARE_ADMIN_AUTH_MODE", "server-proxy");
  vi.stubEnv("VITE_CLOUDFLARE_ADMIN_PROXY_URL", "/api/admin-proxy");
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

describe("M18 admin structured write provider", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    setAppsScriptEnv();
  });

  it("keeps Apps Script as the default structured write provider", async () => {
    googleApiMocks.saveContentItem.mockResolvedValue(sampleContent);
    const { saveContentItem } = await import("../cms-content/api");

    await expect(saveContentItem(sampleContent)).resolves.toEqual(sampleContent);

    expect(googleApiMocks.saveContentItem).toHaveBeenCalledWith(sampleContent);
  });

  it("falls back to Apps Script for invalid Cloudflare provider configuration", async () => {
    vi.stubEnv("VITE_ADMIN_WRITE_PROVIDER", "cloudflare");
    vi.stubEnv("VITE_BACKEND_MIGRATION_MODE", "legacy-apps-script");
    googleApiMocks.saveDocumentToApi.mockResolvedValue(sampleDocument);
    const { saveDocumentToApi } = await import("../cms-documents/api");

    await expect(saveDocumentToApi(sampleDocument)).resolves.toEqual(sampleDocument);

    expect(googleApiMocks.saveDocumentToApi).toHaveBeenCalledWith(sampleDocument);
  });

  it("routes content and document structured writes to Cloudflare only in explicit preview mode", async () => {
    setCloudflareEnv();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));

      if (url.endsWith("/api/admin/content")) {
        return jsonResponse({ item: { ...body, id: sampleContent.id, updatedAt: sampleContent.updatedAt } }, 201);
      }

      if (url.endsWith("/api/admin/documents")) {
        return jsonResponse({ item: { ...body, id: sampleDocument.id, updatedAt: sampleDocument.updatedAt } }, 201);
      }

      return jsonResponse({ error: "not found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { saveContentItem } = await import("../cms-content/api");
    const { saveDocumentToApi } = await import("../cms-documents/api");

    await expect(saveContentItem(sampleContent)).resolves.toMatchObject({ id: sampleContent.id });
    await expect(saveDocumentToApi(sampleDocument)).resolves.toMatchObject({ id: sampleDocument.id });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://preview-worker.example.test/api/admin/content");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      credentials: "include"
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty(["X-RCAT", "Admin", "Write", "Token"].join("-"));
    expect(googleApiMocks.saveContentItem).not.toHaveBeenCalled();
    expect(googleApiMocks.saveDocumentToApi).not.toHaveBeenCalled();
  });

  it("uses PATCH with If-Match for existing content and documents", async () => {
    setCloudflareEnv();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const pathParts = url.split("/");
      return jsonResponse({
        item: { ...body, id: decodeURIComponent(pathParts[pathParts.length - 1] || ""), revision: 4 }
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { saveContentItem } = await import("../cms-content/api");
    const { saveDocumentToApi } = await import("../cms-documents/api");

    await saveContentItem({ ...sampleContent, revision: 3 });
    await saveDocumentToApi({ ...sampleDocument, revision: 3 });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://preview-worker.example.test/api/admin/content/m18-preview-content-001"
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://preview-worker.example.test/api/admin/documents/m18-preview-document-001"
    );
    fetchMock.mock.calls.forEach(([, init]) => {
      expect(init?.method).toBe("PATCH");
      expect(new Headers(init?.headers).get("If-Match")).toBe('"3"');
      expect(JSON.parse(String(init?.body ?? "{}"))).not.toHaveProperty("id");
    });
  });

  it.each([
    ["duplicate content slug", 409],
    ["stale revision", 409]
  ])("surfaces Cloudflare edit conflict: %s", async (message, status) => {
    setCloudflareEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: message }, status))
    );
    const { saveContentItem } = await import("../cms-content/api");

    await expect(saveContentItem({ ...sampleContent, revision: 2 })).rejects.toThrow(message);
  });

  it("keeps media bytes on Apps Script while synchronizing returned metadata to Cloudflare", async () => {
    const savedMedia = {
      id: "m18-preview-media-001",
      name: "M18 preview media",
      type: "document" as const,
      size: "1 MB",
      owner: "preview-editor",
      driveUrl: "https://files.example.test/media-1",
      updatedAt: "2026-06-16T00:00:00.000Z"
    };
    const uploadedMedia = { ...savedMedia, id: "m18-preview-media-002" };
    googleApiMocks.saveMediaAsset.mockResolvedValue(savedMedia);
    googleApiMocks.uploadMediaAsset.mockResolvedValue(uploadedMedia);
    googleApiMocks.deleteMediaAsset.mockResolvedValue({ id: "m18-preview-media-001", deleted: true });
    setCloudflareEnv();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return jsonResponse({ id: "m18-preview-media-001", deleted: true });
      }
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({ item: body });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { saveMediaAsset, uploadMediaAsset, deleteMediaAsset } = await import("../cms-media/api");

    await saveMediaAsset({
      name: "M18 preview media",
      type: "document",
      owner: "preview-editor"
    });
    await uploadMediaAsset({
      id: "m18-preview-media-002",
      name: "M18 uploaded media",
      type: "document",
      size: "",
      owner: "preview-editor",
      driveUrl: "",
      updatedAt: "2026-06-16T00:00:00.000Z"
    });
    await deleteMediaAsset("m18-preview-media-001");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://preview-worker.example.test/api/admin/media");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(googleApiMocks.saveMediaAsset).toHaveBeenCalled();
    expect(googleApiMocks.uploadMediaAsset).toHaveBeenCalled();
    expect(googleApiMocks.deleteMediaAsset).toHaveBeenCalledWith("m18-preview-media-001");
  });

  it("converts a missing server-proxy session into a sign-in-again event", async () => {
    setServerProxyEnv();
    const eventListener = vi.fn();
    window.addEventListener("rcat:admin-proxy-session-expired", eventListener);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "admin proxy session is required" }, 401))
    );
    const { getAdminCmsSnapshot } = await import("../cms-dashboard/api");

    await expect(getAdminCmsSnapshot()).rejects.toThrow("Session expired. Please sign in again.");
    expect(eventListener).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem("rcat.admin.proxy.session.notice")).toBe(
      "Session expired. Please sign in again."
    );
    window.removeEventListener("rcat:admin-proxy-session-expired", eventListener);
  });

  it("keeps Cloudflare admin snapshot GET credentialed without sending a JSON content type", async () => {
    setCloudflareEnv();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        metrics: [],
        content: [],
        documents: [],
        media: [],
        events: [],
        menu: [],
        carouselSlides: [],
        externalServices: [],
        generatedAt: "2026-06-19T00:00:00.000Z"
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { getAdminCmsSnapshot } = await import("../cms-dashboard/api");

    await expect(getAdminCmsSnapshot()).resolves.toMatchObject({
      content: [],
      documents: []
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://preview-worker.example.test/api/admin/snapshot");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: "include"
    });
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);

    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("routes server-proxy admin reads through the same-origin cookie endpoint", async () => {
    setServerProxyEnv();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        metrics: [],
        content: [],
        documents: [],
        media: [],
        events: [],
        menu: [],
        carouselSlides: [],
        externalServices: [],
        generatedAt: "2026-06-19T00:00:00.000Z"
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { getAdminCmsSnapshot } = await import("../cms-dashboard/api");

    await expect(getAdminCmsSnapshot()).resolves.toMatchObject({ content: [], documents: [] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin-proxy?path=%2Fapi%2Fadmin%2Fsnapshot");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: "include" });
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);

    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.has("Content-Type")).toBe(false);
    expect(headers.has("X-RCAT-Admin-Smoke-Token")).toBe(false);
  });

  it("keeps existing mutation result shapes compatible for publish and delete", async () => {
    setCloudflareEnv();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/admin/content/m18-preview-content-001/publish")) {
        return jsonResponse({ id: "m18-preview-content-001", published: true });
      }

      if (url.endsWith("/api/admin/content/m18-preview-content-001") && init?.method === "DELETE") {
        return jsonResponse({ id: "m18-preview-content-001", deleted: true });
      }

      return jsonResponse({ error: "not found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { publishContent, deleteContentItem } = await import("../cms-content/api");

    await expect(publishContent("m18-preview-content-001")).resolves.toEqual({
      id: "m18-preview-content-001",
      published: true
    });
    await expect(deleteContentItem("m18-preview-content-001")).resolves.toEqual({
      id: "m18-preview-content-001",
      deleted: true
    });
  });

  it("routes the remaining structured admin resources to Cloudflare only in explicit preview mode", async () => {
    setCloudflareEnv();
    const menu = [{ id: "menu-1", label: "Sample", href: "/sample", enabled: true }];
    const carousel = {
      id: "slide-1",
      title: "Sample slide",
      subtitle: "",
      chip: "",
      imageUrl: "https://images.example.test/slide.jpg",
      imageAlt: "Sample",
      buttonLabel: "Read",
      href: "/sample",
      enabled: true,
      order: 1,
      updatedAt: "2026-06-20T00:00:00.000Z",
      revision: 2
    };
    const service = {
      id: "service-1",
      title: "Sample service",
      description: "Sanitized preview service",
      href: "https://service.example.test",
      tone: "general" as const,
      iconKey: "link" as const,
      enabled: true,
      order: 1,
      updatedAt: "2026-06-20T00:00:00.000Z",
      revision: 2
    };
    const event = {
      id: "event-1",
      title: "Sample event",
      date: "2026-06-21T00:00:00.000Z",
      audience: "public",
      status: "confirmed" as const,
      visibility: "public" as const,
      updatedAt: "2026-06-20T00:00:00.000Z",
      revision: 2
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      const body = init?.body ? JSON.parse(String(init.body)) : {};

      if (init?.method === "DELETE") {
        const pathSegments = path.split("/");
        const id = decodeURIComponent(pathSegments[pathSegments.length - 1] ?? "");
        return jsonResponse({ id, deleted: true });
      }

      if (path.endsWith("/settings/display") && !init?.method) {
        return jsonResponse({ dateFormat: "D MMMM YYYY", timeMode: "24h" });
      }

      if (path.endsWith("/menu") && !init?.method) {
        return jsonResponse({ items: menu });
      }

      if (path.endsWith("/menu")) {
        return jsonResponse({ items: body.items });
      }

      if (path.includes("/settings/")) {
        return jsonResponse(body);
      }

      return jsonResponse({ item: body });
    });
    vi.stubGlobal("fetch", fetchMock);
    const settingsApi = await import("../cms-settings/api");
    const navigationApi = await import("../cms-navigation/api");
    const carouselApi = await import("../cms-carousel/api");
    const servicesApi = await import("../cms-external-services/api");
    const eventsApi = await import("../cms-events/api");

    await settingsApi.getDisplaySettingsFromApi();
    await settingsApi.saveDisplaySettingsToApi({ dateFormat: "D MMMM YYYY", timeMode: "24h" });
    await settingsApi.saveSiteSettingsToApi({ siteName: "Sample school" });
    await settingsApi.saveHomepageSettingsToApi({});
    await navigationApi.getPublicMenuItems();
    await navigationApi.savePublicMenuItems(menu);
    await carouselApi.saveCarouselSlideToApi(carousel);
    await carouselApi.deleteCarouselSlideFromApi(carousel.id);
    await servicesApi.saveExternalServiceLinkToApi(service);
    await servicesApi.deleteExternalServiceLinkFromApi(service.id);
    await eventsApi.saveCalendarEvent(event);
    await eventsApi.deleteCalendarEvent(event.id);

    expect(fetchMock).toHaveBeenCalledTimes(12);
    for (const callIndex of [6, 8, 10]) {
      expect(fetchMock.mock.calls[callIndex]?.[1]).toMatchObject({
        method: "PATCH",
        headers: { "if-match": '"2"' }
      });
    }
    expect(googleApiMocks.getDisplaySettingsFromApi).not.toHaveBeenCalled();
    expect(googleApiMocks.saveSiteSettingsToApi).not.toHaveBeenCalled();
    expect(googleApiMocks.savePublicMenuItems).not.toHaveBeenCalled();
    expect(googleApiMocks.saveCarouselSlideToApi).not.toHaveBeenCalled();
    expect(googleApiMocks.saveExternalServiceLinkToApi).not.toHaveBeenCalled();
    expect(googleApiMocks.saveCalendarEvent).not.toHaveBeenCalled();
  });
});
