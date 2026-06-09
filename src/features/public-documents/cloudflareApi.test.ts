import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicDocumentListFromCloudflare } from "./cloudflareApi";
import { assertPublicDocumentListSnapshot, isPublicDocumentListSnapshot } from "./contract";
import type { PublicDocumentListSnapshot } from "./types";

const validSnapshot: PublicDocumentListSnapshot = {
  items: [
    {
      id: "document-1",
      title: "Public document",
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

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("public document list contract validation", () => {
  it("accepts the existing PublicDocumentListSnapshot shape", () => {
    expect(isPublicDocumentListSnapshot(validSnapshot)).toBe(true);
    expect(() => assertPublicDocumentListSnapshot(validSnapshot)).not.toThrow();
  });

  it("rejects invalid generatedAt values", () => {
    expect(isPublicDocumentListSnapshot({ ...validSnapshot, generatedAt: "not-a-date" })).toBe(false);
  });

  it("rejects snake_case D1 fields and internal status", () => {
    expect(() =>
      assertPublicDocumentListSnapshot({
        items: [
          {
            id: "document-1",
            title: "Public document",
            description: "Preview document",
            category: "preview",
            file_url: "https://files.example.test/document.pdf",
            file_name: "document.pdf",
            media_id: "media-1",
            published_at: "2026-05-27T00:00:00.000Z",
            sort_order: 1,
            pinned: 1,
            updated_at: "2026-05-28T00:00:00.000Z",
            status: "published"
          }
        ],
        generatedAt: "2026-05-29T00:00:00.000Z"
      })
    ).toThrow("snake_case");
  });
});

describe("getPublicDocumentListFromCloudflare", () => {
  it("fetches the Worker public document route and returns a validated snapshot", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "http://127.0.0.1:8787/");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(validSnapshot));

    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicDocumentListFromCloudflare()).resolves.toEqual(validSnapshot);
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8787/api/public/documents", {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });
  });

  it("requires the Cloudflare public API URL", async () => {
    await expect(getPublicDocumentListFromCloudflare()).rejects.toThrow("VITE_CLOUDFLARE_PUBLIC_API_URL");
  });

  it("rejects non-2xx Worker responses", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "http://127.0.0.1:8787");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "missing DB" }, 503)));

    await expect(getPublicDocumentListFromCloudflare()).rejects.toThrow(
      "Cloudflare public-document-list request failed with HTTP 503"
    );
  });

  it("rejects invalid JSON responses", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "http://127.0.0.1:8787");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{broken", {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        })
      )
    );

    await expect(getPublicDocumentListFromCloudflare()).rejects.toThrow(
      "Cloudflare public-document-list returned invalid JSON"
    );
  });

  it("rejects invalid response shapes", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "http://127.0.0.1:8787");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ items: "not-array", generatedAt: "2026-05-29" })));

    await expect(getPublicDocumentListFromCloudflare()).rejects.toThrow("Invalid public-document-list response");
  });

  it("does not accept D1 row shape directly", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "http://127.0.0.1:8787");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          items: [
            {
              id: "document-1",
              title: "Public document",
              description: "Preview document",
              category: "preview",
              file_url: "https://files.example.test/document.pdf",
              file_name: "document.pdf",
              media_id: "media-1",
              published_at: "2026-05-27T00:00:00.000Z",
              sort_order: 1,
              pinned: 1,
              updated_at: "2026-05-28T00:00:00.000Z",
              status: "published"
            }
          ],
          generatedAt: "2026-05-29T00:00:00.000Z"
        })
      )
    );

    await expect(getPublicDocumentListFromCloudflare()).rejects.toThrow("snake_case");
  });
});
