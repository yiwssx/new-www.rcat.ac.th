import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem } from "../public-content/types";

const cloudflareMock = vi.hoisted(() => ({
  deleteContentItemFromCloudflare: vi.fn(),
  getAdminContentDetailFromCloudflare: vi.fn(),
  publishContentFromCloudflare: vi.fn(),
  saveContentItemToCloudflare: vi.fn()
}));

const mediaMock = vi.hoisted(() => ({
  importFacebookThumbnailAsset: vi.fn()
}));

vi.mock("../admin-write/cloudflareApi", () => cloudflareMock);
vi.mock("../cms-media", () => mediaMock);
vi.mock("../admin-write/errors", () => ({
  isAdminStaleRevisionError: vi.fn(() => false)
}));

import { saveContentItem, type ContentSaveProgress } from "./api";

const facebookContent: ContentItem = {
  id: "content-facebook",
  title: "ข่าวจาก Facebook",
  slug: "facebook-news",
  type: "news",
  status: "draft",
  owner: "facebook-import",
  summary: "สรุปข่าว",
  body: "รายละเอียดข่าว",
  template: "facebook-embed",
  canonicalUrl: "https://www.facebook.com/100063746585360/posts/111",
  mediaIds: [],
  updatedAt: "2026-09-02T00:00:00.000Z",
  publishAt: "",
  revision: 1
};

const thumbnailAsset = {
  id: "facebook-thumbnail-test",
  name: "Facebook - ข่าวจาก Facebook",
  type: "image" as const,
  size: "12 KB",
  owner: "facebook-import",
  driveUrl: "https://drive.google.com/file/d/test/view",
  updatedAt: "2026-09-02T00:00:00.000Z"
};

function collectProgress() {
  const progress: ContentSaveProgress[] = [];
  return {
    progress,
    onProgress: (value: ContentSaveProgress) => progress.push(value)
  };
}

describe("content save progress", () => {
  beforeEach(() => {
    cloudflareMock.saveContentItemToCloudflare.mockReset();
    cloudflareMock.saveContentItemToCloudflare.mockImplementation(async (item: ContentItem) => item);
    mediaMock.importFacebookThumbnailAsset.mockReset();
    mediaMock.importFacebookThumbnailAsset.mockResolvedValue(thumbnailAsset);
  });

  it("reports Facebook thumbnail work before saving the content", async () => {
    const tracker = collectProgress();

    const saved = await saveContentItem(facebookContent, { onProgress: tracker.onProgress });

    expect(mediaMock.importFacebookThumbnailAsset).toHaveBeenCalledTimes(1);
    expect(cloudflareMock.saveContentItemToCloudflare).toHaveBeenCalledWith(
      expect.objectContaining({
        featuredMediaId: thumbnailAsset.id,
        mediaIds: [thumbnailAsset.id]
      })
    );
    expect(saved.featuredMediaId).toBe(thumbnailAsset.id);
    expect(tracker.progress).toEqual([
      { phase: "preparing", percent: 10, message: "กำลังตรวจสอบข้อมูลก่อนบันทึก" },
      { phase: "facebook-thumbnail", percent: 35, message: "กำลังดึงและจัดเก็บภาพย่อจาก Facebook" },
      { phase: "facebook-thumbnail", percent: 65, message: "เตรียมภาพย่อ Facebook เรียบร้อยแล้ว" },
      { phase: "saving", percent: 75, message: "กำลังบันทึกข้อมูลเนื้อหา" },
      { phase: "saving", percent: 85, message: "บันทึกข้อมูลเนื้อหาแล้ว" }
    ]);
  });

  it("continues saving and reports progress when automatic thumbnail creation is unavailable", async () => {
    const tracker = collectProgress();
    mediaMock.importFacebookThumbnailAsset.mockRejectedValueOnce(new Error("preview unavailable"));

    const saved = await saveContentItem(facebookContent, { onProgress: tracker.onProgress });

    expect(saved.featuredMediaId).toBeUndefined();
    expect(cloudflareMock.saveContentItemToCloudflare).toHaveBeenCalledWith(facebookContent);
    expect(tracker.progress).toContainEqual({
      phase: "facebook-thumbnail",
      percent: 60,
      message: "ไม่พบภาพย่ออัตโนมัติ กำลังบันทึกเนื้อหาต่อ"
    });
    expect(tracker.progress[tracker.progress.length - 1]).toEqual({
      phase: "saving",
      percent: 85,
      message: "บันทึกข้อมูลเนื้อหาแล้ว"
    });
  });
});
