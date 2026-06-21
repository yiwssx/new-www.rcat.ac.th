import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { writePublicCache } from "./publicCmsCache";
import { invalidatePublicCmsData } from "./publicCmsInvalidation";

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
      "public-home-snapshot",
      "public-program-list",
      "public-search-index"
    ];

    roots.forEach((root) => queryClient.setQueryData([root, "sample"], { stale: true }));
    const persistedKeys = [
      "rcat.cms.public.snapshot.v2",
      "rcat.cms.public.home.snapshot.v2",
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
    });
    persistedKeys.forEach((key) => expect(window.localStorage.getItem(key)).toBeNull());
  });
});
