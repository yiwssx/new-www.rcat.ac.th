import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicContentDetailPage from "../public/pages/PublicContentDetailPage";
import { CmsSnapshot, ContentItem } from "../types";

const googleApiMocks = vi.hoisted(() => ({
  recordContentView: vi.fn()
}));

let currentSnapshot: CmsSnapshot | undefined;
let currentDetail: ContentItem | undefined;

vi.mock("../services/googleApi", () => ({
  recordContentView: googleApiMocks.recordContentView
}));

vi.mock("../public/hooks/usePublicCmsSnapshot", () => ({
  usePublicCmsSnapshot: () => ({
    data: currentSnapshot,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn()
  })
}));

vi.mock("../public/hooks/usePublicContentDetail", () => ({
  usePublicContentDetail: () => ({
    data: currentDetail,
    isLoading: false,
    isFetching: false
  })
}));

function createContent(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "news-1",
    title: "ข่าวเปิดบ้านวิทยาลัย",
    slug: "open-house-news",
    type: "news",
    status: "published",
    owner: "งานประชาสัมพันธ์",
    summary: "สรุปข่าวเปิดบ้าน",
    body: "รายละเอียดข่าวเปิดบ้าน",
    category: "กิจกรรม",
    tags: ["กิจกรรม", "รับสมัคร"],
    updatedAt: "2026-05-15T09:00:00.000Z",
    publishAt: "2026-05-14T08:00:00.000Z",
    viewCount: 42,
    mediaIds: ["media-1"],
    ...overrides
  };
}

function createSnapshot(content: ContentItem, related: ContentItem): CmsSnapshot {
  return {
    metrics: [],
    content: [content, related],
    media: [
      {
        id: "media-1",
        name: "กำหนดการ.pdf",
        type: "document",
        size: "120 KB",
        owner: "งานประชาสัมพันธ์",
        driveUrl: "https://drive.google.com/file/d/media-1/view",
        updatedAt: "2026-05-14T08:00:00.000Z"
      }
    ],
    events: [],
    menu: []
  };
}

beforeEach(() => {
  window.localStorage.clear();
  googleApiMocks.recordContentView.mockReset();
  googleApiMocks.recordContentView.mockResolvedValue({
    id: "news-1",
    slug: "open-house-news",
    viewCount: 43,
    lastViewedAt: "2026-05-14T09:00:00.000Z"
  });

  currentDetail = createContent();
  currentSnapshot = createSnapshot(
    currentDetail,
    createContent({
      id: "news-2",
      title: "ข่าวกิจกรรมที่เกี่ยวข้อง",
      slug: "related-activity-news",
      summary: "ข่าวที่มีแท็กและหมวดหมู่เดียวกัน",
      tags: ["กิจกรรม"],
      mediaIds: []
    })
  );
});

afterEach(() => {
  cleanup();
});

describe("PublicContentDetailPage public UX regressions", () => {
  it("renders public metadata and no longer shows the technical detail sidebar", () => {
    window.localStorage.setItem("rcat.cms.viewed.news-1", String(Date.now()));

    render(<PublicContentDetailPage slug="open-house-news" />);

    const article = screen.getByRole("article");

    expect(screen.queryByText("รายละเอียดเนื้อหา")).not.toBeInTheDocument();
    expect(screen.queryByText("เทมเพลต")).not.toBeInTheDocument();
    expect(screen.queryByText("URL หลัก")).not.toBeInTheDocument();
    expect(screen.queryByText("ปรับปรุงล่าสุด")).not.toBeInTheDocument();

    expect(within(article).getByText("ข่าว")).toBeInTheDocument();
    expect(within(article).getByText("เผยแพร่แล้ว")).toBeInTheDocument();
    expect(within(article).getByText("14 พฤษภาคม 2569")).toBeInTheDocument();
    expect(within(article).getByText("ผู้เผยแพร่: งานประชาสัมพันธ์")).toBeInTheDocument();
    expect(within(article).getByText("ผู้เข้าดู 42 ครั้ง")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "กลับไปหน้ารายการ" })).toBeInTheDocument();
    expect(screen.getByText("ข่าวกิจกรรมที่เกี่ยวข้อง")).toBeInTheDocument();
  });

  it("keeps tags clickable and still renders attached media", () => {
    window.localStorage.setItem("rcat.cms.viewed.news-1", String(Date.now()));

    render(<PublicContentDetailPage slug="open-house-news" />);

    const article = screen.getByRole("article");
    const activityTag = within(article).getByText("#กิจกรรม").closest("a");

    expect(activityTag).toHaveAttribute(
      "href",
      "/news?tag=%E0%B8%81%E0%B8%B4%E0%B8%88%E0%B8%81%E0%B8%A3%E0%B8%A3%E0%B8%A1"
    );
    expect(screen.getByText("สื่อแนบ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "กำหนดการ.pdf" })).toHaveAttribute(
      "href",
      "https://drive.google.com/file/d/media-1/view"
    );
  });

  it("renders announcement detail with correct metadata, back link, and related announcements", () => {
    const announcementDetail = createContent({
      id: "announcement-1",
      title: "ประกาศสำคัญสำหรับนักเรียน นักศึกษา",
      slug: "important-announcement",
      type: "announcement",
      status: "published",
      owner: "งานประชาสัมพันธ์",
      summary: "ประกาศสำคัญจากสำนักงานเลขานุการ",
      body: "รายละเอียดประกาศสำคัญ",
      tags: ["สำคัญ", "วิทยาลัย"],
      mediaIds: ["media-1"],
      publishAt: "2026-05-14T08:00:00.000Z",
      viewCount: 42
    });

    const relatedAnnouncement = createContent({
      id: "announcement-2",
      title: "ประกาศที่เกี่ยวข้อง",
      slug: "related-important-announcement",
      type: "announcement",
      status: "published",
      owner: "งานประชาสัมพันธ์",
      summary: "ประกาศที่มีแท็กเดียวกัน",
      tags: ["สำคัญ"],
      mediaIds: [],
      publishAt: "2026-05-13T08:00:00.000Z",
      viewCount: 28
    });

    window.localStorage.setItem("rcat.cms.viewed.announcement-1", String(Date.now()));

    currentDetail = announcementDetail;
    currentSnapshot = createSnapshot(announcementDetail, relatedAnnouncement);

    render(<PublicContentDetailPage slug="important-announcement" />);

    const article = screen.getByRole("article");

    // Verify old sidebar is not shown
    expect(screen.queryByText("รายละเอียดเนื้อหา")).not.toBeInTheDocument();
    expect(screen.queryByText("เทมเพลต")).not.toBeInTheDocument();
    expect(screen.queryByText("URL หลัก")).not.toBeInTheDocument();
    expect(screen.queryByText("ปรับปรุงล่าสุด")).not.toBeInTheDocument();

    // Verify article metadata renders correctly
    expect(within(article).getByText("ประกาศ")).toBeInTheDocument();
    expect(within(article).getByText("เผยแพร่แล้ว")).toBeInTheDocument();
    expect(within(article).getByText("14 พฤษภาคม 2569")).toBeInTheDocument();
    expect(within(article).getByText("ผู้เผยแพร่: งานประชาสัมพันธ์")).toBeInTheDocument();
    expect(within(article).getByText("ผู้เข้าดู 42 ครั้ง")).toBeInTheDocument();

    // Verify tags are clickable
    const importantTag = within(article).getByText("#สำคัญ").closest("a");
    expect(importantTag).toHaveAttribute("href", "/announcements?tag=%E0%B8%AA%E0%B8%B3%E0%B8%84%E0%B8%B1%E0%B8%8D");

    // Verify attached media renders
    expect(screen.getByText("เอกสารแนบ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "กำหนดการ.pdf" })).toHaveAttribute(
      "href",
      "https://drive.google.com/file/d/media-1/view"
    );

    // Verify announcement-specific back link
    expect(screen.getAllByRole("link", { name: "กลับไปหน้าประกาศ" }).length).toBeGreaterThan(0);

    // Verify related announcement section renders
    expect(screen.getByText("ประกาศที่เกี่ยวข้อง")).toBeInTheDocument();
    expect(screen.getByText("ประกาศที่เกี่ยวข้องครับท่าน")).toBeInTheDocument();
  });
});
