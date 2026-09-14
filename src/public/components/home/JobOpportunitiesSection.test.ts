import { describe, expect, it } from "vitest";
import type { MediaAsset, PublicContentCardItem } from "../../../types";
import { resolveJobOpportunityPreview } from "./jobOpportunityPreview";

function createItem(overrides: Partial<PublicContentCardItem> = {}): PublicContentCardItem {
  return {
    id: "job-1",
    title: "ประกาศรับสมัครงาน",
    slug: "job-1",
    type: "announcement",
    status: "published",
    owner: "RCAT",
    summary: "รายละเอียดประกาศ",
    publishAt: "2026-09-14T00:00:00.000Z",
    mediaIds: [],
    ...overrides
  };
}

function createMedia(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "media-1",
    name: "document.pdf",
    type: "document",
    size: "120 KB",
    owner: "RCAT",
    driveUrl: "https://drive.google.com/file/d/pdf-file-1/view",
    updatedAt: "2026-09-14T00:00:00.000Z",
    ...overrides
  };
}

describe("resolveJobOpportunityPreview", () => {
  it("prefers an attached image when one is available", () => {
    const image = createMedia({
      id: "image-1",
      name: "cover.jpg",
      type: "image",
      driveUrl: "https://drive.google.com/file/d/image-file-1/view"
    });
    const pdf = createMedia({ id: "pdf-1" });
    const item = createItem({ mediaIds: [pdf.id, image.id] });

    expect(resolveJobOpportunityPreview(item, [pdf, image])).toMatchObject({
      source: image,
      kind: "image",
      label: "cover.jpg"
    });
  });

  it("builds a Google Drive first-page thumbnail from the imported body PDF", () => {
    const item = createItem({
      bodyDocId: "job-pdf-file-1",
      bodyDocUrl: "https://drive.google.com/file/d/job-pdf-file-1/view"
    });

    expect(resolveJobOpportunityPreview(item, [])).toEqual({
      source: "https://drive.google.com/thumbnail?id=job-pdf-file-1&sz=w320",
      kind: "pdf",
      label: "ประกาศรับสมัครงาน"
    });
  });

  it("uses an attached PDF before the body document when both are available", () => {
    const pdf = createMedia({
      id: "pdf-1",
      mimeType: "application/pdf",
      fileId: "attached-pdf-file"
    });
    const item = createItem({ mediaIds: [pdf.id], bodyDocId: "body-pdf-file" });

    expect(resolveJobOpportunityPreview(item, [pdf])).toEqual({
      source: "https://drive.google.com/thumbnail?id=attached-pdf-file&sz=w320",
      kind: "pdf",
      label: "document.pdf"
    });
  });

  it("falls back to the document placeholder when no preview source exists", () => {
    expect(resolveJobOpportunityPreview(createItem(), [])).toEqual({
      source: null,
      kind: "fallback",
      label: "ประกาศรับสมัครงาน"
    });
  });
});
