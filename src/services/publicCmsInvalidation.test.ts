import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import type { ContentItem } from "../types";
import { getPublicContentDetailCache, setPublicContentDetailCache, writePublicCache } from "./publicCmsCache";
import { invalidateDeletedPublicContent, invalidatePublicCmsData } from "./publicCmsInvalidation";

function createContentItem(id: string, slug: string): ContentItem {
  return {
    id,
    title: id,
    slug,
    type: "news",
    status: "published",
    owner: "RCAT",
    summary: "Cached content",
    updatedAt: "2026-07-13T00:00:00.000Z",
    publishAt: "2026-07-13T00:00:00.000Z"
  };
}

describe("public CMS invalidation after admin mutations", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("clears persisted caches and invalidates public list, detail, program, search, and home queries", async () => {
    const queryClient = new QueryClient();
    const roots = [
      "cms-snapshot",
      "content-detail",
      "public-content-list",
      "public-document-list",
      "public-event-list",
      "public-home-snapshot",
      "public-program-list",
      "public-search-index"
    ];

    roots.forEach((root) => queryClient.setQueryData([root, "sample"], { stale: true }));
    const persistedKeys = [
      "rcat.cms.public.snapshot.v2",
      "rcat.cms.public.home.snapshot.v2",
      "rcat.cms.public.event-list",
      "rcat.cms.public.program-list.v2",
      "rcat.cms.public.content-list.v2.news",
      "rcat.cms.public.content-detail.v2.sample",
      "rcat.cms.public.search-index.v2",
      "rcat.cms.public.home.snapshot",
      "rcat.cms.public.program-list",
      "rcat.cms.public.content-detail.v1.sample"
    ];

    persistedKeys.forEach((key) => writePublicCache(key, { stale: true }, 60_000));

    await invalidatePublicCmsData(queryClient);

    roots.forEach((root) => {
      expect(queryClient.getQueryState([root, "sample"])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryData([root, "sample"])).toEqual({ stale: true });
    });
    persistedKeys.forEach((key) => expect(window.localStorage.getItem(key)).toBeNull());
  });

  it("removes only the deleted detail query while preserving existing public invalidation behavior", async () => {
    const queryClient = new QueryClient();
    const deleted = createContentItem("deleted-content", "deleted-slug");
    const other = createContentItem("other-content", "other-slug");
    const otherPublicKeys = [["public-content-list", "news"], ["public-home-snapshot"], ["public-search-index"]];

    queryClient.setQueryData(["content-detail", deleted.slug], deleted);
    queryClient.setQueryData(["content-detail", other.slug], other);
    otherPublicKeys.forEach((key) => queryClient.setQueryData(key, { cached: true }));
    setPublicContentDetailCache(deleted.slug, deleted);
    setPublicContentDetailCache(other.slug, other);

    await invalidateDeletedPublicContent(queryClient, deleted.slug);

    expect(queryClient.getQueryData(["content-detail", deleted.slug])).toBeUndefined();
    expect(queryClient.getQueryData(["content-detail", other.slug])).toEqual(other);
    expect(queryClient.getQueryState(["content-detail", other.slug])?.isInvalidated).toBe(true);
    otherPublicKeys.forEach((key) => {
      expect(queryClient.getQueryData(key)).toEqual({ cached: true });
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    });
    expect(getPublicContentDetailCache(deleted.slug)).toBeNull();
    expect(getPublicContentDetailCache(other.slug)).toBeNull();
  });
});
