import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPublicCmsCache,
  getPublicContentDetailCache,
  setPublicContentDetailCache
} from "../../services/publicCmsCache";
import type { ContentItem, PublicContentDetailSnapshot } from "../../types";
import { usePublicContentDetail } from "./usePublicContentDetail";

const slug = "deleted-news";

function createContent(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "content-1",
    title: "Cached content",
    slug,
    type: "news",
    status: "published",
    owner: "RCAT",
    summary: "Cached summary",
    body: "Cached body",
    updatedAt: "2026-07-13T00:00:00.000Z",
    publishAt: "2026-07-13T00:00:00.000Z",
    ...overrides
  };
}

function createDetailSnapshot(item: ContentItem): PublicContentDetailSnapshot {
  return {
    item,
    media: [],
    generatedAt: item.updatedAt
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
}

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
});

afterEach(() => {
  clearPublicCmsCache();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("usePublicContentDetail", () => {
  it("replaces stale query data with null and removes the exact persistent cache after HTTP 404", async () => {
    const queryClient = createQueryClient();
    const staleContent = createContent();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    setPublicContentDetailCache(slug, createDetailSnapshot(staleContent));

    const { result } = renderHook(() => usePublicContentDetail({ slug }), {
      wrapper: createWrapper(queryClient)
    });

    expect(result.current.data).toEqual(staleContent);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["content-detail", slug], exact: true });
    });

    await waitFor(() => expect(result.current.data).toBeNull());
    expect(result.current.isSuccess).toBe(true);
    expect(queryClient.getQueryData(["content-detail", slug])).toBeNull();
    expect(getPublicContentDetailCache(slug)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns successful content and persists the full detail snapshot", async () => {
    const queryClient = createQueryClient();
    const content = createContent({ title: "Fresh content" });
    const snapshot = createDetailSnapshot(content);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(snapshot), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    const { result } = renderHook(() => usePublicContentDetail({ slug }), {
      wrapper: createWrapper(queryClient)
    });

    await waitFor(() => expect(result.current.data).toEqual(content));
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.media).toEqual([]);
    expect(getPublicContentDetailCache(slug)?.data).toEqual(snapshot);
  });

  it("keeps valid persisted detail media and exposes non-404 failures as query errors", async () => {
    const queryClient = createQueryClient();
    const staleContent = createContent();
    const staleSnapshot = createDetailSnapshot(staleContent);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "temporary failure" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        })
      )
    );
    setPublicContentDetailCache(slug, staleSnapshot);

    const { result } = renderHook(() => usePublicContentDetail({ slug }), {
      wrapper: createWrapper(queryClient)
    });

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["content-detail", slug], exact: true });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("temporary failure");
    expect(result.current.data).toEqual(staleContent);
    expect(result.current.media).toEqual([]);
    expect(getPublicContentDetailCache(slug)?.data).toEqual(staleSnapshot);
  });
});
