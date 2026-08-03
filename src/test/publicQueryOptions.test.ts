import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "../queryClient";
import { publicContentDetailQueryOptions, publicContentListQueryOptions } from "../features/public-content/query";
import { publicDocumentListQueryOptions } from "../features/public-documents/query";
import { publicEventListQueryOptions } from "../features/public-events/query";
import { publicHomeQueryKey, publicHomeQueryOptions } from "../features/public-home/query";
import { publicProgramListQueryOptions } from "../features/public-programs/query";
import { publicSearchIndexQueryOptions } from "../features/public-search/query";
import { publicCmsSnapshotQueryOptions } from "../features/public-read/cmsSnapshot";
import { PUBLIC_QUERY_GC_TIME_MS } from "../features/public-read/queryPolicy";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("SSR-ready public query options", () => {
  it("preserves the existing query keys while keeping browser cache state outside reusable options", () => {
    const options = [
      publicHomeQueryOptions(),
      publicContentListQueryOptions("news"),
      publicContentDetailQueryOptions("sample-news"),
      publicProgramListQueryOptions(),
      publicSearchIndexQueryOptions(),
      publicEventListQueryOptions(),
      publicDocumentListQueryOptions(),
      publicCmsSnapshotQueryOptions()
    ];

    expect(options.map((option) => option.queryKey)).toEqual([
      ["public-home-snapshot"],
      ["public-content-list", "news"],
      ["content-detail", "sample-news"],
      ["public-program-list"],
      ["public-search-index"],
      ["public-event-list"],
      ["public-document-list"],
      ["cms-snapshot"]
    ]);

    options.forEach((option) => {
      expect(option.gcTime).toBe(PUBLIC_QUERY_GC_TIME_MS);
      expect(option.initialData).toBeUndefined();
      expect(option.initialDataUpdatedAt).toBeUndefined();
    });

    expect(publicContentDetailQueryOptions(undefined).enabled).toBe(false);
  });

  it("lets TanStack Query cancellation abort the underlying public fetch", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    const queryClient = createAppQueryClient();
    let receivedSignal: AbortSignal | null = null;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      receivedSignal = init?.signal instanceof AbortSignal ? init.signal : null;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
          once: true
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = queryClient.fetchQuery(publicHomeQueryOptions());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await queryClient.cancelQueries({ queryKey: publicHomeQueryKey });

    expect(receivedSignal).not.toBeNull();
    expect(receivedSignal?.aborted).toBe(true);
    await pending.catch(() => undefined);
  });
});
