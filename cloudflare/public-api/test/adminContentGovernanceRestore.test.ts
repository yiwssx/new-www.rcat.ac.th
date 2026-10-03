// @vitest-environment node
import { describe, expect, it } from "vitest";
import { normalizeRevisionRestoreSnapshot } from "../src/routes/adminContentGovernance";

describe("revision restore snapshot policy", () => {
  it("restores editable content as a draft without publication dates", () => {
    expect(
      normalizeRevisionRestoreSnapshot({
        slug: "old-news",
        type: "news",
        status: "published",
        title: "Old news",
        publishAt: "2026-01-01T00:00:00.000Z",
        unpublishAt: "2026-02-01T00:00:00.000Z"
      })
    ).toMatchObject({
      slug: "old-news",
      type: "news",
      status: "draft",
      publishAt: "",
      unpublishAt: ""
    });
  });

  it("rejects deleted and missing slugs", () => {
    expect(normalizeRevisionRestoreSnapshot({ slug: "__deleted__:content-1" })).toBeNull();
    expect(normalizeRevisionRestoreSnapshot({ title: "No slug" })).toBeNull();
    expect(normalizeRevisionRestoreSnapshot(null)).toBeNull();
  });
});
