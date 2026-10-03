import { describe, expect, it } from "vitest";
import type { ContentRevision } from "../../features/cms-governance/client";
import { revisionActionLabel, snapshotSummaryRows } from "./RevisionHistoryViewer.utils";

const revision: ContentRevision = {
  id: "internal-revision-id",
  contentId: "content-1",
  revision: 7,
  reason: "publish",
  actor: "editor@example.invalid",
  createdAt: "2026-10-03T07:00:00.000Z",
  snapshot: {
    id: "content-1",
    slug: "example-content",
    type: "news",
    status: "published",
    owner: "communications",
    title: "Example content",
    summary: "Summary",
    body: "Body",
    category: "news",
    tags: [],
    seoTitle: "",
    seoDescription: "",
    canonicalUrl: "",
    featured: false,
    readingMinutes: 1,
    template: "standard",
    bodyDocId: "",
    bodyDocUrl: "",
    featuredMediaId: "",
    mediaIds: [],
    viewCount: 0,
    lastViewedAt: "",
    updatedAt: "2026-10-03T07:00:00.000Z",
    publishAt: "2026-10-03T07:00:00.000Z",
    unpublishAt: "",
    revision: 7
  }
};

describe("RevisionHistoryViewer", () => {
  it("labels revision actions for operators", () => {
    expect(revisionActionLabel("create")).toBe("สร้าง");
    expect(revisionActionLabel("publish")).toBe("เผยแพร่");
    expect(revisionActionLabel("unpublish")).toBe("ยกเลิกเผยแพร่");
    expect(revisionActionLabel("custom-action")).toBe("custom-action");
  });

  it("exposes useful snapshot metadata without internal revision identifiers", () => {
    const rows = snapshotSummaryRows(revision);
    const values = rows.flatMap(([label, value]) => [label, value]);

    expect(values).toContain("Example content");
    expect(values).toContain("example-content");
    expect(values).toContain("published");
    expect(values).toContain("communications");
    expect(values).not.toContain(revision.id);
    expect(values).not.toContain(revision.contentId);
  });

  it("handles a revision whose snapshot cannot be decoded", () => {
    expect(snapshotSummaryRows({ ...revision, snapshot: null })).toEqual([]);
  });
});
