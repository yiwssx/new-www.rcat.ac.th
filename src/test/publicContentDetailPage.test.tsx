import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

    const article = screen.getByRole("article");

    expect(screen.queryByText("รายละเอียดเนื้อหา")).not.toBeInTheDocument();
    expect(screen.queryByText("สื่อแนบ")).not.toBeInTheDocument();
    expect(screen.queryByText("ผู้รับผิดชอบ")).not.toBeInTheDocument();
    expect(screen.queryByText("ปรับปรุงล่าสุด")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "กลับไปหน้ารายการ" })).not.toBeInTheDocument();

    expect(within(article).getByText("ผู้โพสต์: งานประชาสัมพันธ์")).toBeInTheDocument();
    expect(within(article).getByText(/เผยแพร่:/)).toBeInTheDocument();
    expect(within(article).getByText(/อัปเดต:/)).toBeInTheDocument();
    expect(within(article).getByText("เอกสารแนบ")).toBeInTheDocument();
    expect(within(article).getByRole("link", { name: "ใบสมัคร.pdf" })).toBeInTheDocument();

    const articleText = article.textContent || "";
    expect(articleText.indexOf("ประกาศรับสมัคร")).toBeLessThan(articleText.indexOf("ผู้โพสต์: งานประชาสัมพันธ์"));
    expect(articleText.indexOf("ผู้โพสต์: งานประชาสัมพันธ์")).toBeLessThan(articleText.indexOf("เนื้อหาประกาศ"));
    expect(articleText.indexOf("เนื้อหาประกาศ")).toBeLessThan(articleText.indexOf("เอกสารแนบ"));

    const tagLink = within(article).getByText("#รับสมัคร").closest("a");
    const categoryLink = within(article).getByText("งานทะเบียน").closest("a");

    expect(tagLink?.getAttribute("href")).toBe(
      "/announcements?tag=%E0%B8%A3%E0%B8%B1%E0%B8%9A%E0%B8%AA%E0%B8%A1%E0%B8%B1%E0%B8%84%E0%B8%A3"
    );
    expect(categoryLink?.getAttribute("href")).toBe(
      "/announcements?category=%E0%B8%87%E0%B8%B2%E0%B8%99%E0%B8%97%E0%B8%B0%E0%B9%80%E0%B8%9A%E0%B8%B5%E0%B8%A2%E0%B8%99"
    );

    await waitFor(() =>
      expect(googleApiMocks.recordContentView).toHaveBeenCalledWith({
        id: "content-1",
        slug: "announcement-1"
      })
    );
    expect(await within(article).findByText("ดูแล้ว 13 ครั้ง")).toBeInTheDocument();
    expect(window.localStorage.getItem("rcat.cms.viewed.content-1")).toMatch(/^\d+$/);
  });

  it("omits updated metadata for announcements when publish and update times match", () => {
    currentDetail = createContent({
      updatedAt: "2026-05-03T08:00:00.000Z",
      publishAt: "2026-05-03T08:00:00.000Z"
    });
    currentSnapshot = createSnapshot(currentDetail);
    window.localStorage.setItem("rcat.cms.viewed.content-1", String(Date.now()));

    render(<PublicContentDetailPage slug="announcement-1" />);

    const article = screen.getByRole("article");
    expect(within(article).getByText(/เผยแพร่:/)).toBeInTheDocument();
    expect(within(article).queryByText(/อัปเดต:/)).not.toBeInTheDocument();
  });

  it("does not debounce failed content view attempts", async () => {
    googleApiMocks.recordContentView.mockRejectedValueOnce(new Error("offline"));
    currentDetail = createContent();
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="announcement-1" />);

    await waitFor(() =>
      expect(googleApiMocks.recordContentView).toHaveBeenCalledWith({
        id: "content-1",
        slug: "announcement-1"
      })
    );
    expect(window.localStorage.getItem("rcat.cms.viewed.content-1")).toBeNull();
  });

  it("keeps the generic sidebar for non-announcement content", async () => {
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
    expect(screen.getByText("ผู้รับผิดชอบ")).toBeInTheDocument();
    expect(screen.getByText("ปรับปรุงล่าสุด")).toBeInTheDocument();
    expect(screen.getByText("สื่อแนบ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ใบสมัคร.pdf" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "กลับไปหน้ารายการ" })).toBeInTheDocument();
    expect(screen.getByText("#ข่าวกิจกรรม").closest("a")?.getAttribute("href")).toBe(
      "/news?tag=%E0%B8%82%E0%B9%88%E0%B8%B2%E0%B8%A7%E0%B8%81%E0%B8%B4%E0%B8%88%E0%B8%81%E0%B8%A3%E0%B8%A3%E0%B8%A1"
    );
    expect(screen.getByText("กิจกรรม").closest("a")?.getAttribute("href")).toBe(
      "/news?category=%E0%B8%81%E0%B8%B4%E0%B8%88%E0%B8%81%E0%B8%A3%E0%B8%A3%E0%B8%A1"
    );
    await waitFor(() =>
      expect(googleApiMocks.recordContentView).toHaveBeenCalledWith({
        id: "content-1",
        slug: "news-1"
      })
    );
  });
});
