import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MediaAsset } from "../../types";
import { MediaAssetCard } from "./MediaPage";

const documentAsset: MediaAsset = {
  id: "document-media-1",
  name: "คู่มือการใช้งาน.pdf",
  type: "document",
  size: "2.6 MB",
  owner: "Admin",
  driveUrl: "https://drive.google.com/file/d/document-file-1/view",
  fileId: "document-file-1",
  mimeType: "application/pdf",
  previewUrl: "https://drive.google.com/file/d/document-file-1/preview",
  embedUrl: "https://drive.google.com/file/d/document-file-1/preview",
  updatedAt: "2026-07-14T10:00:00+07:00"
};

function renderCard(asset: MediaAsset) {
  return render(<MediaAssetCard asset={asset} onEdit={vi.fn()} onDelete={vi.fn()} />);
}

describe("MediaAssetCard document preview", () => {
  it("renders a Drive thumbnail for a document instead of the document icon", () => {
    renderCard(documentAsset);

    expect(screen.getByRole("img", { name: documentAsset.name })).toHaveAttribute(
      "src",
      "https://drive.google.com/thumbnail?id=document-file-1&sz=w1200"
    );
    expect(screen.getByText("เอกสาร")).toBeInTheDocument();
  });

  it("derives the Drive file id from the Drive URL for older media records", () => {
    const legacyAsset: MediaAsset = {
      ...documentAsset,
      id: "legacy-document-media",
      fileId: undefined,
      driveUrl: "https://drive.google.com/file/d/legacy-document-file/view",
      previewUrl: "https://drive.google.com/file/d/legacy-document-file/preview",
      embedUrl: "https://drive.google.com/file/d/legacy-document-file/preview"
    };

    renderCard(legacyAsset);

    expect(screen.getByRole("img", { name: legacyAsset.name })).toHaveAttribute(
      "src",
      "https://drive.google.com/thumbnail?id=legacy-document-file&sz=w1200"
    );
  });

  it("falls back cleanly when Drive cannot render a thumbnail", () => {
    renderCard(documentAsset);

    fireEvent.error(screen.getByRole("img", { name: documentAsset.name }));

    expect(screen.queryByRole("img", { name: documentAsset.name })).not.toBeInTheDocument();
    expect(screen.getByText("ไม่สามารถแสดงตัวอย่างได้")).toBeInTheDocument();
  });
});
