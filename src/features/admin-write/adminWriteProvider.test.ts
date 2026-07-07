import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem } from "../public-content/types";
import type { CmsDocumentItem } from "../cms-documents/types";

const mediaBridgeMocks = vi.hoisted(() => ({
  deleteMediaAssetFromBridge: vi.fn(),
  saveMediaAssetToBridge: vi.fn(),
  uploadMediaAssetToBridge: vi.fn()
}));

vi.mock("../cms-media/mediaBridgeClient", () => mediaBridgeMocks);

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

  it("fails closed when Cloudflare admin config is missing", async () => {
    const { saveContentItem } = await import("../cms-content/api");

    await expect(saveContentItem(sampleContent)).rejects.toThrow(
      "A dev or preview Cloudflare admin API URL is required"
    );
  });

  it("does not fall back to Apps Script for legacy provider configuration", async () => {
    vi.stubEnv("VITE_ADMIN_WRITE_PROVIDER", "cloudflare");
    vi.stubEnv("VITE_BACKEND_MIGRATION_MODE", "legacy-apps-script");
    const { saveDocumentToApi } = await import("../cms-documents/api");

    await expect(saveDocumentToApi(sampleDocument)).rejects.toThrow(
      "A dev or preview Cloudflare admin API URL is required"
    );
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

    await expect(saveContentItem({ ...sampleContent, id: "" })).resolves.toMatchObject({ id: sampleContent.id });
    await expect(saveDocumentToApi(sampleDocument)).resolves.toMatchObject({ id: sampleDocument.id });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://preview-worker.example.test/api/admin/content");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      credentials: "include"
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty(["X-RCAT", "Admin", "Write", "Token"].join("-"));
  });

  it("uses PATCH with a custom revision header and never sends If-Match", async () => {
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
      expect(new Headers(init?.headers).get("X-RCAT-Expected-Revision")).toBe("3");
      expect(new Headers(init?.headers).has("If-Match")).toBe(false);
      expect(JSON.parse(String(init?.body ?? "{}"))).not.toHaveProperty("id");
    });
  });

  it("uses PATCH for existing content without a revision and omits the revision header", async () => {
    setCloudflareEnv();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({ item: { ...body, id: sampleContent.id } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { saveContentItem } = await import("../cms-content/api");

    await saveContentItem(sampleContent);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://preview-worker.example.test/api/admin/content/m18-preview-content-001"
    );
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PATCH");
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has("X-RCAT-Expected-Revision")).toBe(false);
  });

  it("uses PATCH for existing E-Service links with an id even when revision is missing", async () => {
    setCloudflareEnv();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({ item: { ...body, id: url.split("/").pop(), revision: 3 } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { saveExternalServiceLinkToApi } = await import("../cms-external-services/api");

    await saveExternalServiceLinkToApi({
      id: "service-1",
      title: "Student portal",
      href: "https://service.example.test/student",
      enabled: true,
      order: 2
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://preview-worker.example.test/api/admin/external-services/service-1"
    );
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PATCH");
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has("X-RCAT-Expected-Revision")).toBe(false);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"))).not.toHaveProperty("id");
  });

  it("uses PATCH with a revision header for existing E-Service links when revision is present", async () => {
    setCloudflareEnv();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({ item: { ...body, id: url.split("/").pop(), revision: 5 } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { saveExternalServiceLinkToApi } = await import("../cms-external-services/api");

    await saveExternalServiceLinkToApi({
      id: "service-1",
      title: "Student portal",
      href: "https://service.example.test/student",
      enabled: true,
      order: 2,
      revision: 4
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://preview-worker.example.test/api/admin/external-services/service-1"
    );
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PATCH");
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("X-RCAT-Expected-Revision")).toBe("4");
  });

  it("uses POST for new E-Service links without an id", async () => {
    setCloudflareEnv();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({ item: { ...body, id: "service-new", revision: 0 } }, 201);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { saveExternalServiceLinkToApi } = await import("../cms-external-services/api");

    await saveExternalServiceLinkToApi({
      title: "New service",
      href: "https://service.example.test/new",
      enabled: true,
      order: 1
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://preview-worker.example.test/api/admin/external-services");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
  });

  it("batch saves E-Service links through PUT /api/admin/external-services", async () => {
    setCloudflareEnv();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({ items: body.items });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { saveExternalServiceLinksToApi } = await import("../cms-external-services/api");

    await saveExternalServiceLinksToApi([
      {
        id: "service-1",
        title: "Student portal",
        href: "https://service.example.test/student",
        enabled: true,
        order: 1,
        revision: 2
      }
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://preview-worker.example.test/api/admin/external-services");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "PUT",
      credentials: "include"
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"))).toEqual({
      items: [
        expect.objectContaining({
          id: "service-1",
          order: 1
        })
      ]
    });
  });

  it("surfaces a duplicate slug conflict without retrying as create", async () => {
    setCloudflareEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "duplicate slug", resource: "content", field: "slug" }, 409))
    );
    const { saveContentItem } = await import("../cms-content/api");

    await expect(saveContentItem({ ...sampleContent, revision: 2 })).rejects.toThrow(
      "Slug นี้ถูกใช้แล้ว กรุณาเปลี่ยน Slug"
    );
  });

  it.each([
    ["worker stale conflict", () => jsonResponse({ error: "stale revision" }, 409)],
    ["proxy conditional response", () => new Response("precondition failed", { status: 412 })]
  ])("refetches the current item and returns a Thai stale message for %s", async (_label, staleResponse) => {
    setCloudflareEnv();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return staleResponse();
      }

      return jsonResponse({ item: { ...sampleContent, revision: 4, title: "Latest server title" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { isAdminStaleRevisionError, saveContentItem } = await import("../cms-content");

    const error = await saveContentItem({ ...sampleContent, revision: 2 }).catch(
      (currentError: unknown) => currentError
    );

    expect(isAdminStaleRevisionError(error)).toBe(true);
    expect(error).toMatchObject({
      message: "ข้อมูลนี้มีการเปลี่ยนแปลง ระบบโหลดข้อมูลล่าสุดแล้ว กรุณาตรวจสอบและบันทึกอีกครั้ง",
      latestItem: expect.objectContaining({ revision: 4, title: "Latest server title" })
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://preview-worker.example.test/api/admin/content/m18-preview-content-001"
    );
  });

  it("publishes Cloudflare content through the content publish route with only valid revision headers", async () => {
    setCloudflareEnv();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ id: sampleContent.id, published: true })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { publishContent } = await import("../cms-content/api");

    await publishContent({ id: sampleContent.id, revision: 2 });
    await publishContent({ id: sampleContent.id, revision: -1 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://preview-worker.example.test/api/admin/content/m18-preview-content-001/publish"
    );
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain("external-services");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: "{}",
      credentials: "include"
    });
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("X-RCAT-Expected-Revision")).toBe("2");
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).has("X-RCAT-Expected-Revision")).toBe(false);
  });

  it("refreshes the current item when Cloudflare content publish returns stale revision", async () => {
    setCloudflareEnv();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/admin/content/m18-preview-content-001/publish") && init?.method === "POST") {
        return jsonResponse({ error: "stale revision" }, 409);
      }

      return jsonResponse({ item: { ...sampleContent, title: "Latest publish title", revision: 5 } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { isAdminStaleRevisionError, publishContent } = await import("../cms-content");

    const error = await publishContent({ id: sampleContent.id, revision: 2 }).catch(
      (currentError: unknown) => currentError
    );

    expect(isAdminStaleRevisionError(error)).toBe(true);
    expect(error).toMatchObject({
      latestItem: expect.objectContaining({ revision: 5, title: "Latest publish title" })
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://preview-worker.example.test/api/admin/content/m18-preview-content-001/publish"
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://preview-worker.example.test/api/admin/content/m18-preview-content-001"
    );
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
    mediaBridgeMocks.saveMediaAssetToBridge.mockResolvedValue(savedMedia);
    mediaBridgeMocks.uploadMediaAssetToBridge.mockResolvedValue(uploadedMedia);
    mediaBridgeMocks.deleteMediaAssetFromBridge.mockResolvedValue({ id: "m18-preview-media-001", deleted: true });
    setCloudflareEnv();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
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
    expect(mediaBridgeMocks.saveMediaAssetToBridge).toHaveBeenCalled();
    expect(mediaBridgeMocks.uploadMediaAssetToBridge).toHaveBeenCalled();
    expect(mediaBridgeMocks.deleteMediaAssetFromBridge).toHaveBeenCalledWith("m18-preview-media-001");
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

      if (path.includes("/visitor-stats/daily/")) {
        return jsonResponse({
          item: {
            day: "2026-06-20",
            total: body.total,
            uniqueVisitors: body.uniqueVisitors,
            onlineUsers: body.onlineUsers,
            updatedAt: "2026-06-20T00:00:00.000Z"
          }
        });
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
    await settingsApi.saveVisitorStatsToApi({ enabled: true, usersToday: 3, totalViews: 9, onlineUsers: 1 });
    await navigationApi.getPublicMenuItems();
    await navigationApi.savePublicMenuItems(menu);
    await carouselApi.saveCarouselSlideToApi(carousel);
    await carouselApi.deleteCarouselSlideFromApi(carousel.id);
    await servicesApi.saveExternalServiceLinkToApi(service);
    await servicesApi.deleteExternalServiceLinkFromApi(service.id);
    await eventsApi.saveCalendarEvent(event);
    await eventsApi.deleteCalendarEvent(event.id);

    expect(fetchMock).toHaveBeenCalledTimes(13);
    expect(fetchMock.mock.calls[4]?.[0]).toContain("/api/admin/visitor-stats/daily/");
    expect(fetchMock.mock.calls[4]?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({
        total: 9,
        uniqueVisitors: 3,
        onlineUsers: 1
      })
    });
    for (const callIndex of [7, 9, 11]) {
      expect(fetchMock.mock.calls[callIndex]?.[1]).toMatchObject({
        method: "PATCH",
        headers: { "x-rcat-expected-revision": "2" }
      });
    }
  });

  it("creates and edits carousel slides through the correct Cloudflare routes without Apps Script", async () => {
    setCloudflareEnv();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({ item: { ...body, id: url.endsWith("/api/admin/carousel") ? "slide-new" : "slide-1" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { saveCarouselSlideToApi } = await import("../cms-carousel/api");
    const baseSlide = {
      title: "",
      imageUrl: "https://images.example.test/slide.jpg",
      enabled: true,
      order: 1
    };

    await saveCarouselSlideToApi({ ...baseSlide, id: "" });
    await saveCarouselSlideToApi({ ...baseSlide, id: "slide-1" });
    await saveCarouselSlideToApi({ ...baseSlide, id: "slide-1", revision: 2 });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://preview-worker.example.test/api/admin/carousel");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://preview-worker.example.test/api/admin/carousel/slide-1");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PATCH");
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).has("X-RCAT-Expected-Revision")).toBe(false);
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("X-RCAT-Expected-Revision")).toBe("2");
  });
});
