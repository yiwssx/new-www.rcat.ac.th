import { describe, expect, it } from "vitest";
import type { MediaAsset, PublicContentCardItem } from "../../../types";
import { resolveProcurementPreview } from "./procurementPreview";

function createItem(overrides: Partial<PublicContentCardItem> = {}): PublicContentCardItem {
  return {
    id: "procurement-1",
    title: "ประกาศจัดซื้อจัดจ้าง",
    slug: "procurement-1",
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

describe("resolveProcurementPreview", () => {
  it("prefers an attached image when one is available", () => {
    const image = createMedia({
      id: "image-1",
      name: "cover.jpg",
      type: "image",
      driveUrl: "https://drive.google.com/file/d/image-file-1/view"
    });
    const pdf = createMedia({ id: "pdf-1" });
    const item = createItem({ mediaIds: [pdf.id, image.id] });

    expect(resolveProcurementPreview(item, [pdf, image])).toMatchObject({
      source: image,
      kind: "image",
      label: "cover.jpg"
    });
  });

  it("builds a Google Drive first-page thumbnail from the imported body PDF", () => {
    const item = createItem({
      bodyDocId: "procurement-pdf-file-1",
      bodyDocUrl: "https://drive.google.com/file/d/procurement-pdf-file-1/view"
    });

    expect(resolveProcurementPreview(item, [])).toEqual({
      source: "https://drive.google.com/thumbnail?id=procurement-pdf-file-1&sz=w320",
      kind: "pdf",
      label: "ประกาศจัดซื้อจัดจ้าง"
    });
  });

  it("uses an attached PDF before the body document when both are available", () => {
    const pdf = createMedia({
      id: "pdf-1",
      mimeType: "application/pdf",
      fileId: "attached-pdf-file"
    });
    const item = createItem({ mediaIds: [pdf.id], bodyDocId: "body-pdf-file" });

    expect(resolveProcurementPreview(item, [pdf])).toEqual({
      source: "https://drive.google.com/thumbnail?id=attached-pdf-file&sz=w320",
      kind: "pdf",
      label: "document.pdf"
    });
  });

  it("falls back to the document placeholder when no preview source exists", () => {
    expect(resolveProcurementPreview(createItem(), [])).toEqual({
      source: null,
      kind: "fallback",
      label: "ประกาศจัดซื้อจัดจ้าง"
    });
  });
});
