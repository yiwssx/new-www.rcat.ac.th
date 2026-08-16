import { describe, expect, it } from "vitest";
import { PUBLIC_CACHE_FRESHNESS_MS, PUBLIC_QUERY_GC_TIME_MS } from "../config/publicCachePolicy";
import { publicContentDetailQueryOptions, publicContentListQueryOptions } from "../features/public-content/query";
import { publicDocumentListQueryOptions } from "../features/public-documents/query";
import { publicEventListQueryOptions } from "../features/public-events/query";
import { publicHomeQueryOptions } from "../features/public-home/query";
import { publicCmsSnapshotQueryOptions } from "../features/public-read/cmsSnapshot";
import { publicProgramListQueryOptions } from "../features/public-programs/query";
import { publicSearchIndexQueryOptions } from "../features/public-search/query";
import { publicShellQueryOptions } from "../features/public-shell/query";
import contentQuerySource from "../features/public-content/query.ts?raw";
import documentQuerySource from "../features/public-documents/query.ts?raw";
import eventQuerySource from "../features/public-events/query.ts?raw";
import homeQuerySource from "../features/public-home/query.ts?raw";
import programQuerySource from "../features/public-programs/query.ts?raw";
import searchQuerySource from "../features/public-search/query.ts?raw";
import contentDetailHookSource from "../public/hooks/usePublicContentDetail.ts?raw";
import contentListHookSource from "../public/hooks/usePublicContentList.ts?raw";
import cmsSnapshotHookSource from "../public/hooks/usePublicCmsSnapshot.ts?raw";
import documentHookSource from "../public/hooks/usePublicDocumentList.ts?raw";
import eventHookSource from "../public/hooks/usePublicEventList.ts?raw";
import homeHookSource from "../public/hooks/usePublicHomeSnapshot.ts?raw";
import programHookSource from "../public/hooks/usePublicProgramList.ts?raw";
import searchHookSource from "../public/hooks/usePublicSearchIndex.ts?raw";
import invalidationSource from "../services/publicCmsInvalidation.ts?raw";
import queryClientSource from "../queryClient.ts?raw";

const activeQuerySources = [
  contentQuerySource,
  documentQuerySource,
  eventQuerySource,
  homeQuerySource,
  programQuerySource,
  searchQuerySource
];

const activeHookSources = [
  contentDetailHookSource,
  contentListHookSource,
  documentHookSource,
  eventHookSource,
  homeHookSource,
  programHookSource,
  searchHookSource
];

describe("P5E public cache consistency", () => {
  it("keeps one explicit freshness policy for shell, collections, detail, and GC", () => {
    expect(PUBLIC_CACHE_FRESHNESS_MS).toEqual({
      shell: 120_000,
      collection: 900_000,
      detail: 1_800_000
    });
    expect(PUBLIC_QUERY_GC_TIME_MS).toBe(3_600_000);
  });

  it("binds every public query family to the canonical freshness class", () => {
    expect(publicShellQueryOptions().staleTime).toBe(PUBLIC_CACHE_FRESHNESS_MS.shell);
    expect(publicCmsSnapshotQueryOptions().staleTime).toBe(PUBLIC_CACHE_FRESHNESS_MS.shell);

    [
      publicHomeQueryOptions(),
      publicContentListQueryOptions("news"),
      publicDocumentListQueryOptions(),
      publicEventListQueryOptions(),
      publicProgramListQueryOptions(),
      publicSearchIndexQueryOptions()
    ].forEach((options) => expect(options.staleTime).toBe(PUBLIC_CACHE_FRESHNESS_MS.collection));

    expect(publicContentDetailQueryOptions("sample").staleTime).toBe(PUBLIC_CACHE_FRESHNESS_MS.detail);

    [
      publicShellQueryOptions(),
      publicCmsSnapshotQueryOptions(),
      publicHomeQueryOptions(),
      publicContentListQueryOptions("news"),
      publicContentDetailQueryOptions("sample"),
      publicDocumentListQueryOptions(),
      publicEventListQueryOptions(),
      publicProgramListQueryOptions(),
      publicSearchIndexQueryOptions()
    ].forEach((options) => expect(options.gcTime).toBe(PUBLIC_QUERY_GC_TIME_MS));
  });

  it("keeps active public query functions free of a second localStorage cache owner", () => {
    activeQuerySources.forEach((source) => {
      expect(source).not.toMatch(/setPublic\w+Cache/);
      expect(source).not.toContain("writePublicCache");
      expect(source).not.toContain("localStorage");
    });
  });

  it("keeps active public hooks owned by TanStack Query rather than persisted initialData", () => {
    activeHookSources.forEach((source) => {
      expect(source).not.toMatch(/getPublic\w+Cache/);
      expect(source).not.toContain("initialData");
      expect(source).not.toContain("initialDataUpdatedAt");
      expect(source).not.toContain("isPublicQueryCacheFresh");
    });
  });

  it("delegates the legacy CmsSnapshot shell compatibility hook to public-shell", () => {
    expect(cmsSnapshotHookSource).toContain("usePublicShellSnapshot");
    expect(cmsSnapshotHookSource).not.toContain("publicCmsSnapshotQueryOptions");
    expect(cmsSnapshotHookSource).not.toContain("getPublicSnapshotCache");
  });

  it("uses QueryClient as the active invalidation authority and purges legacy persistence only on boot", () => {
    expect(invalidationSource).not.toContain("clearPublicCmsCache");
    expect(invalidationSource).not.toContain("removePublicContentDetailCache");
    expect(invalidationSource).toContain('"public-shell"');
    expect(invalidationSource).not.toContain('"cms-snapshot"');

    expect(queryClientSource).toContain("retireLegacyPublicPersistence");
    expect(queryClientSource).toContain("clearPublicCmsCache");
  });
});
