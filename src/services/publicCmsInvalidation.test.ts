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
    writePublicCache("rcat.cms.public.home.snapshot", { stale: true }, 60_000);
    writePublicCache("rcat.cms.public.program-list", { stale: true }, 60_000);
    writePublicCache("rcat.cms.public.content-detail.v1.sample", { stale: true }, 60_000);

    await invalidatePublicCmsData(queryClient);

    roots.forEach((root) => {
      expect(queryClient.getQueryState([root, "sample"])?.isInvalidated).toBe(true);
    });
    expect(window.localStorage.getItem("rcat.cms.public.home.snapshot")).toBeNull();
    expect(window.localStorage.getItem("rcat.cms.public.program-list")).toBeNull();
    expect(window.localStorage.getItem("rcat.cms.public.content-detail.v1.sample")).toBeNull();
  });
});
