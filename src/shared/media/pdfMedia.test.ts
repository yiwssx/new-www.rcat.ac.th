import { describe, expect, it } from "vitest";
import type { MediaAsset } from "../../types";
import { getPdfOpenUrl, getPdfViewerUrl, isPdfMediaAsset } from "./pdfMedia";

function createAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "pdf-1",
    name: "document.pdf",
    type: "document",
    size: "1 MB",
    owner: "งานสารบรรณ",
    driveUrl: "https://drive.google.com/file/d/pdf-1/view",
    previewUrl: "https://drive.google.com/file/d/pdf-1/preview",
    embedUrl: "https://drive.google.com/file/d/pdf-1/preview",
    updatedAt: "2026-08-06T00:00:00.000Z",
    ...overrides
  };
}

describe("pdfMedia", () => {
  it("detects PDFs by MIME type or filename", () => {
    expect(isPdfMediaAsset(createAsset({ name: "document.bin", mimeType: "application/pdf" }))).toBe(true);
    expect(isPdfMediaAsset(createAsset({ name: "DOCUMENT.PDF", mimeType: "" }))).toBe(true);
    expect(isPdfMediaAsset(createAsset({ name: "document.docx", mimeType: "application/msword" }))).toBe(false);
  });

  it("prefers embed preview for the viewer and Drive URL for opening", () => {
    const asset = createAsset();

    expect(getPdfViewerUrl(asset)).toBe("https://drive.google.com/file/d/pdf-1/preview");
    expect(getPdfOpenUrl(asset)).toBe("https://drive.google.com/file/d/pdf-1/view");
  });

  it("rejects unsafe viewer URLs while retaining a safe open fallback", () => {
    const asset = createAsset({
      driveUrl: "javascript:alert(1)",
      previewUrl: "http://example.com/document.pdf",
      embedUrl: "javascript:alert(1)"
    });

    expect(getPdfViewerUrl(asset)).toBe("");
    expect(getPdfOpenUrl(asset)).toBe("http://example.com/document.pdf");
  });
});
