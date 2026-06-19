import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem } from "../public-content/types";
import type { CmsDocumentItem } from "../cms-documents/types";

const googleApiMocks = vi.hoisted(() => ({
  deleteContentItem: vi.fn(),
  deleteDocumentFromApi: vi.fn(),
  getAdminCmsSnapshot: vi.fn(),
  getAdminContentDetail: vi.fn(),
  publishContent: vi.fn(),
  saveContentItem: vi.fn(),
  saveDocumentToApi: vi.fn(),
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
        return jsonResponse({ item: { ...body, updatedAt: sampleContent.updatedAt } }, 201);
      }

      if (url.endsWith("/api/admin/documents")) {
        return jsonResponse({ item: { ...body, updatedAt: sampleDocument.updatedAt } }, 201);
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

  it("keeps media upload and delete operations on Apps Script", async () => {
    googleApiMocks.saveMediaAsset.mockResolvedValue({ id: "m18-preview-media-001" });
    googleApiMocks.uploadMediaAsset.mockResolvedValue({ id: "m18-preview-media-002" });
    googleApiMocks.deleteMediaAsset.mockResolvedValue({ id: "m18-preview-media-001", deleted: true });
    setCloudflareEnv();
    const fetchMock = vi.fn();
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

    expect(fetchMock).not.toHaveBeenCalled();
    expect(googleApiMocks.saveMediaAsset).toHaveBeenCalled();
    expect(googleApiMocks.uploadMediaAsset).toHaveBeenCalled();
    expect(googleApiMocks.deleteMediaAsset).toHaveBeenCalledWith("m18-preview-media-001");
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
});
