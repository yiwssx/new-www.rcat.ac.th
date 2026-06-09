import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicDocumentListSnapshot } from "./types";
import {
  PUBLIC_DOCUMENT_LIST_CACHE_KEY,
  PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS,
  getPublicDocumentListCache,
  setPublicDocumentListCache
} from "./publicDocumentListCache";

const appsScriptSnapshot: PublicDocumentListSnapshot = {
  items: [],
  generatedAt: "2026-05-27T00:00:00.000Z"
};
const cloudflareSnapshot: PublicDocumentListSnapshot = {
  items: [
    {
      id: "document-1",
      title: "Worker document",
      description: "Preview document",
      category: "preview",
      fileUrl: "https://files.example.test/document.pdf",
      fileName: "document.pdf",
      mediaId: "media-1",
      publishedAt: "2026-05-27T00:00:00.000Z",
      order: 1,
      pinned: true,
      updatedAt: "2026-05-28T00:00:00.000Z"
    }
  ],
  generatedAt: "2026-05-29T00:00:00.000Z"
};

vi.mock("../../services/googleApi", () => ({
  getPublicDocumentList: vi.fn()
}));

vi.mock("./cloudflareApi", () => ({
  getPublicDocumentListFromCloudflare: vi.fn()
}));

import { getPublicDocumentList as getPublicDocumentListFromAppsScript } from "../../services/googleApi";
import { getPublicDocumentList } from "./api";
import { getPublicDocumentListFromCloudflare } from "./cloudflareApi";

const appsScriptMock = vi.mocked(getPublicDocumentListFromAppsScript);
const cloudflareMock = vi.mocked(getPublicDocumentListFromCloudflare);

afterEach(() => {
  vi.unstubAllEnvs();
  appsScriptMock.mockReset();
  cloudflareMock.mockReset();
  window.localStorage.clear();
});

describe("public document provider switch", () => {
  it("keeps the default public document provider on Apps Script", async () => {
    appsScriptMock.mockResolvedValue(appsScriptSnapshot);

    await expect(getPublicDocumentList()).resolves.toEqual(appsScriptSnapshot);
    expect(appsScriptMock).toHaveBeenCalledTimes(1);
    expect(cloudflareMock).not.toHaveBeenCalled();
  });

  it("keeps unknown provider values on Apps Script", async () => {
    vi.stubEnv("VITE_PUBLIC_API_PROVIDER", "worker");
    appsScriptMock.mockResolvedValue(appsScriptSnapshot);

    await expect(getPublicDocumentList()).resolves.toEqual(appsScriptSnapshot);
    expect(appsScriptMock).toHaveBeenCalledTimes(1);
    expect(cloudflareMock).not.toHaveBeenCalled();
  });

  it("uses Cloudflare only when explicitly selected", async () => {
    vi.stubEnv("VITE_PUBLIC_API_PROVIDER", "cloudflare");
    cloudflareMock.mockResolvedValue(cloudflareSnapshot);

    await expect(getPublicDocumentList()).resolves.toEqual(cloudflareSnapshot);
    expect(cloudflareMock).toHaveBeenCalledTimes(1);
    expect(appsScriptMock).not.toHaveBeenCalled();
  });

  it("keeps the exported return shape compatible with PublicDocumentListSnapshot", async () => {
    appsScriptMock.mockResolvedValue(appsScriptSnapshot);

    const snapshot: PublicDocumentListSnapshot = await getPublicDocumentList();

    expect(snapshot).toEqual(appsScriptSnapshot);
  });

  it("preserves the public document cache key and TTL", () => {
    setPublicDocumentListCache(cloudflareSnapshot);

    expect(PUBLIC_DOCUMENT_LIST_CACHE_KEY).toBe("rcat.cms.public.document-list");
    expect(PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS).toBe(15 * 60 * 1000);
    expect(getPublicDocumentListCache()?.data).toEqual(cloudflareSnapshot);
  });
});
