import { describe, expect, it } from "vitest";
import { createPublicHomeSnapshot } from "../src/adapters/publicHomeAdapter";
import type { PublicMetadataContract } from "../src/contracts/publicMetadata";
import type { PublicVisitorStatsSnapshotContract } from "../src/contracts/publicVisitorStats";
import type { PublicContentSummaryReadRow } from "../src/db/contentRepository";

function createRow(id: string, category: string, day: number): PublicContentSummaryReadRow {
  return {
    id,
    slug: id,
    type: "announcement",
    status: "published",
    owner: "RCAT",
    title: `ประกาศ ${category} ${id}`,
    summary: "รายละเอียด",
    category,
    tags_json: "[]",
    featured_media_id: id === "general-7" ? "media-general-7" : "",
    media_ids_json: id === "general-7" ? '["media-general-7"]' : "[]",
    publish_at: `2026-10-${String(day).padStart(2, "0")}T00:00:00.000Z`
  } as PublicContentSummaryReadRow;
}

describe("public home general announcements", () => {
  it("provides the four newest general posts even when all sidebar announcements are specialized", () => {
    const content = Array.from({ length: 8 }, (_, index) =>
      createRow(`procurement-${index}`, "จัดซื้อจัดจ้าง", 20 - index)
    );
    const generalAnnouncements = [
      ...Array.from({ length: 7 }, (_, index) => createRow(`general-${index + 1}`, "ทั่วไป", index + 1)),
      createRow("job", "รับสมัครงาน", 21)
    ];

    const metadata = {
      events: [],
      carouselSlides: [],
      externalServices: [],
      media: [
        {
          id: "media-general-7",
          name: "thumbnail.jpg",
          type: "image",
          size: "12 KB",
          owner: "RCAT",
          driveUrl: "https://example.com/thumbnail.jpg",
          updatedAt: "2026-10-07T00:00:00.000Z"
        }
      ]
    } as unknown as PublicMetadataContract;

    const snapshot = createPublicHomeSnapshot(
      {
        content,
        generalAnnouncements,
        featuredDocuments: [],
        metadata,
        visitorStats: {} as PublicVisitorStatsSnapshotContract
      },
      new Date("2026-10-20T00:00:00.000Z")
    );

    expect(snapshot.latestAnnouncements).toHaveLength(8);
    expect(snapshot.generalAnnouncementItems?.map((item) => item.id)).toEqual([
      "general-7",
      "general-6",
      "general-5",
      "general-4"
    ]);
    expect(snapshot.generalAnnouncementItems).toHaveLength(4);
    expect(snapshot.media.map((asset) => asset.id)).toContain("media-general-7");
  });
});
