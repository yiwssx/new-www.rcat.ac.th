import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MediaAsset } from "../../types";
import { MediaAssetCard } from "./MediaPage";

const asset: MediaAsset = {
  id: "media-original-1",
  name: "original-photo.jpg",
  type: "image",
  size: "4.8 MB",
  owner: "editor",
  driveUrl: "https://drive.google.com/file/d/original-file/view",
  fileId: "original-file",
  mimeType: "image/jpeg",
  thumbnailUrl: "https://drive.google.com/thumbnail?id=original-file&sz=w1200",
  previewUrl: "https://drive.google.com/file/d/original-file/preview",
  embedUrl: "https://drive.google.com/file/d/original-file/preview",
  updatedAt: "2026-06-21T10:00:00+07:00"
};

describe("MediaAssetCard", () => {
  it("uses display-only preview metadata while keeping the original Drive link and size", () => {
    const { rerender } = render(<MediaAssetCard asset={asset} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByRole("img", { name: asset.name })).toHaveAttribute("src", asset.thumbnailUrl);
    expect(screen.getByRole("link", { name: "เปิดสื่อ" })).toHaveAttribute("href", asset.driveUrl);
    expect(screen.getByText(asset.size)).toBeInTheDocument();

    fireEvent.error(screen.getByRole("img", { name: asset.name }));

    expect(screen.queryByRole("img", { name: asset.name })).not.toBeInTheDocument();
    expect(screen.getByText("ไม่สามารถแสดงตัวอย่างได้")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิดสื่อ" })).toHaveAttribute("href", asset.driveUrl);

    rerender(<MediaAssetCard asset={{ ...asset, thumbnailUrl: undefined }} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByRole("img", { name: asset.name })).toHaveAttribute("src", asset.previewUrl);
  });
});
