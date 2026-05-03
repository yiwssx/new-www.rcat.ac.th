import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicContentDetailPage from "../public/pages/PublicContentDetailPage";
import { CmsSnapshot, ContentItem } from "../types";

const googleApiMocks = vi.hoisted(() => ({
  recordContentView: vi.fn()
}));

let currentSnapshot: CmsSnapshot;
let currentDetail: ContentItem | undefined;

vi.mock("../services/googleApi", () => ({
  recordContentView: googleApiMocks.recordContentView
}));

vi.mock("../public/hooks/usePublicCmsSnapshot", () => ({
  usePublicCmsSnapshot: () => ({
    data: currentSnapshot,
    isLoading: false
  })
}));

vi.mock("../public/hooks/usePublicContentDetail", () => ({
  usePublicContentDetail: () => ({
    data: currentDetail,
    isLoading: false
  })
}));

function createContent(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "content-1",
    title: "ประกาศรับสมัคร",
    slug: "announcement-1",
    type: "announcement",
    status: "published",
    owner: "งานประชาสัมพันธ์",
    summary: "รายละเอียดประกาศรับสมัคร",
    body: "เนื้อหาประกาศ",
    category: "งานทะเบียน",
    tags: ["รับสมัคร", "นักศึกษา"],
    updatedAt: "2026-05-03T09:30:00.000Z",
    publishAt: "2026-05-03T08:00:00.000Z",
    viewCount: 12,
    mediaIds: ["media-1"],
    ...overrides
  };
}

function createSnapshot(content: ContentItem): CmsSnapshot {
  return {
    metrics: [],
    content: [content],
    media: [
      {
        id: "media-1",
        name: "ใบสมัคร.pdf",
        type: "document",
        size: "",
        owner: "",
        driveUrl: "https://drive.google.com/file/d/media-1/view",
        updatedAt: ""
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
    id: "content-1",
    slug: "announcement-1",
    viewCount: 13,
    lastViewedAt: "2026-05-03T10:00:00.000Z"
  });
});

afterEach(() => {
  cleanup();
});

describe("PublicContentDetailPage", () => {
  it("renders announcements as an article without the generic detail sidebar", async () => {
    currentDetail = createContent();
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="announcement-1" />);

    expect(screen.queryByText("รายละเอียดเนื้อหา")).not.toBeInTheDocument();
    expect(screen.queryByText("สื่อแนบ")).not.toBeInTheDocument();
    expect(screen.getByText("ผู้โพสต์: งานประชาสัมพันธ์")).toBeInTheDocument();
    expect(screen.getByText(/เผยแพร่:/)).toBeInTheDocument();
    expect(screen.getByText(/อัปเดต:/)).toBeInTheDocument();
    expect(screen.getByText("เอกสารแนบ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ใบสมัคร.pdf" })).toBeInTheDocument();

    const tagLink = screen.getByText("#รับสมัคร").closest("a");
    const categoryLink = screen.getByText("งานทะเบียน").closest("a");

    expect(tagLink?.getAttribute("href")).toBe("/announcements?tag=%E0%B8%A3%E0%B8%B1%E0%B8%9A%E0%B8%AA%E0%B8%A1%E0%B8%B1%E0%B8%84%E0%B8%A3");
    expect(categoryLink?.getAttribute("href")).toBe("/announcements?category=%E0%B8%87%E0%B8%B2%E0%B8%99%E0%B8%97%E0%B8%B0%E0%B9%80%E0%B8%9A%E0%B8%B5%E0%B8%A2%E0%B8%99");

    await waitFor(() => expect(googleApiMocks.recordContentView).toHaveBeenCalledWith({
      id: "content-1",
      slug: "announcement-1"
    }));
    expect(await screen.findByText("ดูแล้ว 13 ครั้ง")).toBeInTheDocument();
  });

  it("keeps the generic sidebar for non-announcement content", () => {
    currentDetail = createContent({
      type: "news",
      title: "ข่าวกิจกรรม",
      slug: "news-1",
      tags: ["ข่าวกิจกรรม"],
      category: "กิจกรรม"
    });
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="news-1" />);

    expect(screen.getByText("รายละเอียดเนื้อหา")).toBeInTheDocument();
    expect(screen.getByText("สื่อแนบ")).toBeInTheDocument();
    expect(screen.getByText("#ข่าวกิจกรรม").closest("a")?.getAttribute("href")).toBe(
      "/news?tag=%E0%B8%82%E0%B9%88%E0%B8%B2%E0%B8%A7%E0%B8%81%E0%B8%B4%E0%B8%88%E0%B8%81%E0%B8%A3%E0%B8%A3%E0%B8%A1"
    );
  });
});
