import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicDocumentListSnapshot } from "./types";
import {
  PUBLIC_DOCUMENT_LIST_CACHE_KEY,
  PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS,
  getPublicDocumentListCache,
  setPublicDocumentListCache
} from "./publicDocumentListCache";

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

vi.mock("./cloudflareApi", () => ({
  getPublicDocumentListFromCloudflare: vi.fn()
}));

import { getPublicDocumentList } from "./api";
import { getPublicDocumentListFromCloudflare } from "./cloudflareApi";

const cloudflareMock = vi.mocked(getPublicDocumentListFromCloudflare);

beforeEach(() => {
  vi.stubEnv("VITE_PUBLIC_API_PROVIDER", "");
  vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  cloudflareMock.mockReset();
  window.localStorage.clear();
});

describe("public document API wrapper", () => {
  it("uses the Cloudflare public document list API", async () => {
    cloudflareMock.mockResolvedValue(cloudflareSnapshot);

    await expect(getPublicDocumentList()).resolves.toEqual(cloudflareSnapshot);
    expect(cloudflareMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the exported return shape compatible with PublicDocumentListSnapshot", async () => {
    cloudflareMock.mockResolvedValue(cloudflareSnapshot);

    const snapshot: PublicDocumentListSnapshot = await getPublicDocumentList();

    expect(snapshot).toEqual(cloudflareSnapshot);
  });

  it("preserves the public document cache key and TTL", () => {
    setPublicDocumentListCache(cloudflareSnapshot);

    expect(PUBLIC_DOCUMENT_LIST_CACHE_KEY).toBe("rcat.cms.public.document-list");
    expect(PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS).toBe(15 * 60 * 1000);
    expect(getPublicDocumentListCache()?.data).toEqual(cloudflareSnapshot);
  });
});
