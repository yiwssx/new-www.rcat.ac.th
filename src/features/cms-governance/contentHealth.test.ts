import { describe, expect, it } from "vitest";
import type { MediaAsset } from "../cms-media/types";
import type { ContentItem } from "../public-content/types";
import { serializeContentBlocksToBody } from "../../utils/contentBlocks";
import { evaluateContentHealth } from "./contentHealth";

function makeContent(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "content-1",
    title: "ข่าวทดสอบ",
    slug: "test-news",
    type: "news",
    status: "published",
    owner: "งานประชาสัมพันธ์",
    summary: "สรุปข่าว",
    body: serializeContentBlocksToBody([
      {
        id: "rich-1",
        type: "richText",
        document: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "เนื้อหาข่าว" }] }]
        }
      }
    ]),
    seoTitle: "ข่าวทดสอบ",
    seoDescription: "รายละเอียดข่าวทดสอบ",
    featuredMediaId: "image-1",
    mediaIds: ["image-1"],
    updatedAt: "2026-09-20T00:00:00.000Z",
    publishAt: "2026-09-20T00:00:00.000Z",
    ...overrides
  };
}

function makeImage(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "image-1",
    name: "ภาพข่าว",
    type: "image",
    size: "100 KB",
    owner: "งานประชาสัมพันธ์",
    driveUrl: "https://drive.google.com/file/d/example",
    altText: "กิจกรรมของวิทยาลัย",
    updatedAt: "2026-09-20T00:00:00.000Z",
    ...overrides
  };
}

describe("content health evaluation", () => {
  it("reports healthy content when editorial, SEO, media, and accessibility fields are complete", () => {
    const report = evaluateContentHealth([makeContent()], [makeImage()], new Date("2026-09-23T00:00:00.000Z"));

    expect(report.totalContent).toBe(1);
    expect(report.healthyContent).toBe(1);
    expect(report.issueCount).toBe(0);
  });

  it("detects incomplete published content and missing media accessibility metadata", () => {
    const report = evaluateContentHealth(
      [
        makeContent({
          owner: "",
          summary: "",
          seoDescription: ""
        })
      ],
      [makeImage({ altText: "" })],
      new Date("2026-09-23T00:00:00.000Z")
    );

    expect(report.issueCounts["missing-summary"]).toBe(1);
    expect(report.issueCounts["missing-owner"]).toBe(1);
    expect(report.issueCounts["missing-seo"]).toBe(1);
    expect(report.issueCounts["missing-image-alt"]).toBe(1);
    expect(report.healthyContent).toBe(0);
  });

  it("detects stale editorial work, empty rich text, and missing media references", () => {
    const emptyBody = serializeContentBlocksToBody([
      {
        id: "rich-empty",
        type: "richText",
        document: { type: "doc", content: [{ type: "paragraph" }] }
      }
    ]);
    const report = evaluateContentHealth(
      [
        makeContent({
          status: "review",
          body: emptyBody,
          featuredMediaId: "missing-media",
          mediaIds: ["missing-media"],
          updatedAt: "2026-07-01T00:00:00.000Z"
        })
      ],
      [],
      new Date("2026-09-23T00:00:00.000Z")
    );

    expect(report.issueCounts["missing-body"]).toBe(1);
    expect(report.issueCounts["missing-media"]).toBe(1);
    expect(report.issueCounts["stale-editorial-item"]).toBe(1);
  });
});
