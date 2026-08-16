import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { invalidateDeletedPublicContent, invalidatePublicCmsData } from "./publicCmsInvalidation";

const activePublicRoots = [
  "content-detail",
  "public-content-list",
  "public-document-list",
  "public-event-list",
  "public-home-snapshot",
  "public-program-list",
  "public-search-index",
  "public-shell"
];

describe("public CMS invalidation after admin mutations", () => {
  it("invalidates every active public QueryClient root without treating legacy cms-snapshot as an owner", async () => {
    const queryClient = new QueryClient();

    activePublicRoots.forEach((root) => queryClient.setQueryData([root, "sample"], { stale: true }));
    queryClient.setQueryData(["cms-snapshot", "legacy"], { legacy: true });
    queryClient.setQueryData(["admin-only", "sample"], { private: true });

    await invalidatePublicCmsData(queryClient);

    activePublicRoots.forEach((root) => {
      expect(queryClient.getQueryState([root, "sample"])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryData([root, "sample"])).toEqual({ stale: true });
    });
    expect(queryClient.getQueryState(["cms-snapshot", "legacy"])?.isInvalidated).toBe(false);
    expect(queryClient.getQueryData(["cms-snapshot", "legacy"])).toEqual({ legacy: true });
    expect(queryClient.getQueryState(["admin-only", "sample"])?.isInvalidated).toBe(false);
  });

  it("removes the deleted detail query and invalidates the remaining active public queries", async () => {
    const queryClient = new QueryClient();
    const deletedKey = ["content-detail", "deleted-slug"] as const;
    const otherDetailKey = ["content-detail", "other-slug"] as const;
    const otherPublicKeys = [
      ["public-content-list", "news"],
      ["public-home-snapshot"],
      ["public-search-index"],
      ["public-shell"]
    ] as const;

    queryClient.setQueryData(deletedKey, { id: "deleted" });
    queryClient.setQueryData(otherDetailKey, { id: "other" });
    otherPublicKeys.forEach((key) => queryClient.setQueryData(key, { cached: true }));

    await invalidateDeletedPublicContent(queryClient, "deleted-slug");

    expect(queryClient.getQueryData(deletedKey)).toBeUndefined();
    expect(queryClient.getQueryState(deletedKey)).toBeUndefined();
    expect(queryClient.getQueryData(otherDetailKey)).toEqual({ id: "other" });
    expect(queryClient.getQueryState(otherDetailKey)?.isInvalidated).toBe(true);
    otherPublicKeys.forEach((key) => {
      expect(queryClient.getQueryData(key)).toEqual({ cached: true });
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    });
  });
});
