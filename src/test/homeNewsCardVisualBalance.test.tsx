import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicContentCard from "../public/components/PublicContentCard";
import type { ContentItem, MediaAsset } from "../types";

function createContentItem(): ContentItem {
  return {
    id: "home-news-1",
    title: "ข่าวประชาสัมพันธ์สำหรับทดสอบการ์ดหน้าแรก",
    slug: "home-news-card",
    type: "news",
    status: "published",
    owner: "Admin",
    summary: "ข้อความสรุปสำหรับตรวจสอบสมดุลของภาพและตัวอักษรบนการ์ดข่าวหน้าแรก",
    category: "ข่าวประชาสัมพันธ์",
    tags: ["กิจกรรม", "ประชาสัมพันธ์"],
    readingMinutes: 1,
    featuredMediaId: "media-1",
    updatedAt: "2026-09-09T00:00:00.000Z",
    publishAt: "2026-09-09T00:00:00.000Z"
  };
}

function createMediaAsset(): MediaAsset {
  return {
    id: "media-1",
    name: "Home news thumbnail",
    type: "image",
    size: "120 KB",
    owner: "Admin",
    driveUrl: "https://drive.google.com/file/d/home-news-thumb/view",
    previewUrl: "https://example.edu/home-news.jpg",
    embedUrl: "",
    updatedAt: "2026-09-09T00:00:00.000Z"
  };
}

describe("home news card visual balance", () => {
  it("uses a larger thumbnail and moves reading time out of the badge row", () => {
    const { container } = render(
      <PublicContentCard item={createContentItem()} mediaAssets={[createMediaAsset()]} presentation="home-news" />
    );

    const card = screen.getByRole("link", { name: /ข่าวประชาสัมพันธ์สำหรับทดสอบการ์ดหน้าแรก/ });
    const mediaSlot = container.querySelector('[data-public-content-card-media-slot="regular"]') as HTMLElement;
    const image = within(card).getByRole("img", { name: "Home news thumbnail" });
    const readingMeta = within(card).getByText("Admin · อ่าน 1 นาที");

    expect(card).toHaveAttribute("data-public-content-card-presentation", "home-news");
    expect(mediaSlot).toHaveStyle({ width: "120px", height: "90px" });
    expect(image).toHaveAttribute("sizes", "120px");
    expect(readingMeta.closest(".MuiChip-root")).toBeNull();
  });
});
