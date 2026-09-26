import { describe, expect, it } from "vitest";
import type { ContentItem } from "../public-content/types";
import { compareRevisionBody, compareRevisionFields } from "./revisionDiff";

function content(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "content-1",
    title: "ข่าวเดิม",
    slug: "old-slug",
    type: "news",
    status: "draft",
    owner: "ประชาสัมพันธ์",
    summary: "สรุปเดิม",
    body: "บรรทัดหนึ่ง\nบรรทัดสอง",
    category: "ข่าว",
    tags: ["กิจกรรม"],
    updatedAt: "2026-09-01T00:00:00.000Z",
    publishAt: "2026-09-01T00:00:00.000Z",
    ...overrides
  };
}

describe("revision diff", () => {
  it("reports changed metadata and normalizes array values", () => {
    const changes = compareRevisionFields(
      content(),
      content({ title: "ข่าวใหม่", slug: "new-slug", tags: ["กิจกรรม", "รางวัล"] })
    );

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "title", before: "ข่าวเดิม", after: "ข่าวใหม่" }),
        expect.objectContaining({ key: "slug", before: "old-slug", after: "new-slug" }),
        expect.objectContaining({ key: "tags", before: "กิจกรรม", after: "กิจกรรม, รางวัล" })
      ])
    );
  });

  it("returns an LCS-style line diff for body changes", () => {
    expect(compareRevisionBody("A\nB\nC", "A\nX\nC")).toEqual([
      { type: "context", text: "A" },
      { type: "removed", text: "B" },
      { type: "added", text: "X" },
      { type: "context", text: "C" }
    ]);
  });

  it("returns no changes for equivalent revisions", () => {
    const item = content();
    expect(compareRevisionFields(item, { ...item })).toEqual([]);
    expect(compareRevisionBody(item.body, item.body)).toEqual([]);
  });
});
