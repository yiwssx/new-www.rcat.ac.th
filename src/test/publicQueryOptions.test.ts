import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "../queryClient";
import { publicContentDetailQueryOptions, publicContentListQueryOptions } from "../features/public-content/query";
import { publicDocumentListQueryOptions } from "../features/public-documents/query";
import { publicEventListQueryOptions } from "../features/public-events/query";
import { publicHomeQueryKey, publicHomeQueryOptions } from "../features/public-home/query";
import { publicProgramListQueryOptions } from "../features/public-programs/query";
import { publicSearchIndexQueryOptions, publicSearchPageQueryOptions } from "../features/public-search/query";
import { publicShellQueryOptions } from "../features/public-shell/query";
import { publicCmsSnapshotQueryOptions } from "../features/public-read/cmsSnapshot";
import { getPublicQueryRequestOptions, PUBLIC_QUERY_GC_TIME_MS } from "../features/public-read/queryPolicy";

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
      publicShellQueryOptions(),
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
      ["public-shell"],
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
    expect(publicContentListQueryOptions("announcements", {}, { page: 2, pageSize: 120 }).queryKey).toEqual([
      "public-content-list",
      "announcements",
      "pages",
      2,
      100
    ]);
    expect(publicContentListQueryOptions("news", {}, undefined, { page: 2, pageSize: 120 }).queryKey).toEqual([
      "public-content-list",
      "news",
      "page",
      2,
      100
    ]);
    expect(publicSearchIndexQueryOptions("  award  ").queryKey).toEqual(["public-search-index", "award"]);
    expect(publicSearchPageQueryOptions(" award ", { page: 2, pageSize: 120 }).queryKey).toEqual([
      "public-search-index",
      "page",
      "award",
      2,
      100
    ]);
  });

  it("does not consume TanStack's signal for browser-compatible query reuse when opted out", () => {
    const controller = new AbortController();
    let signalReads = 0;
    const context = {
      get signal() {
        signalReads += 1;
        return controller.signal;
      }
    };

    expect(getPublicQueryRequestOptions(context, { consumeAbortSignal: false })).toEqual({});
    expect(signalReads).toBe(0);
    expect(getPublicQueryRequestOptions(context)).toEqual({ signal: controller.signal });
    expect(signalReads).toBe(1);
  });

  it("lets TanStack Query cancellation abort the underlying public fetch", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    const queryClient = createAppQueryClient();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
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

    const fetchSignal = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(fetchSignal).toBeInstanceOf(AbortSignal);
    if (!(fetchSignal instanceof AbortSignal)) {
      throw new Error("Expected public query fetch to receive an AbortSignal.");
    }
    expect(fetchSignal.aborted).toBe(true);
    await pending.catch(() => undefined);
  });
});