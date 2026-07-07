import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicContentDetailPage from "../public/pages/PublicContentDetailPage";
import { CmsSnapshot, ContentItem } from "../types";

const siteViewMocks = vi.hoisted(() => ({
  recordContentView: vi.fn()
}));
const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn()
}));

let currentSnapshot: CmsSnapshot | undefined;
let currentDetail: ContentItem | undefined;
let currentSnapshotQueryState = {
  isLoading: false,
  isFetching: false
};
let currentDetailQueryState = {
  isLoading: false,
  isFetching: false
};

vi.mock("../features/site-view", () => ({
  recordContentView: siteViewMocks.recordContentView
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => routerMocks.navigate
}));

vi.mock("../public/hooks/usePublicCmsSnapshot", () => ({
  usePublicCmsSnapshot: () => ({
    data: currentSnapshot,
    ...currentSnapshotQueryState
  })
}));

vi.mock("../public/hooks/usePublicContentDetail", () => ({
  usePublicContentDetail: () => ({
    data: currentDetail,
    ...currentDetailQueryState
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
  routerMocks.navigate.mockReset();
  currentDetail = createContent();
  currentSnapshot = createSnapshot(currentDetail);
  currentSnapshotQueryState = {
    isLoading: false,
    isFetching: false
  };
  currentDetailQueryState = {
    isLoading: false,
    isFetching: false
  };
  siteViewMocks.recordContentView.mockReset();
  siteViewMocks.recordContentView.mockResolvedValue({
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
  it("shows loading instead of not found while the snapshot is loading", () => {
    currentSnapshot = undefined;
    currentDetail = undefined;
    currentSnapshotQueryState = {
      isLoading: true,
      isFetching: false
    };
    currentDetailQueryState = {
      isLoading: false,
      isFetching: false
    };

    render(<PublicContentDetailPage slug="announcement-1" />);

    expect(screen.getAllByRole("progressbar").length).toBeGreaterThan(0);
    expect(document.body).not.toHaveTextContent("กำลังโหลดข้อมูล");
    expect(document.body).not.toHaveTextContent("กำลังเชื่อมต่อระบบฐานข้อมูล");
    expect(document.title).not.toContain("กำลังโหลดข้อมูล");
    expect(screen.queryByText(/ไม่พบเนื้อหา/)).not.toBeInTheDocument();
  });

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

    expect(within(article).getByText("ประกาศ")).toBeInTheDocument();
    expect(within(article).getByText("เผยแพร่แล้ว")).toBeInTheDocument();
    expect(within(article).getByText("3 พฤษภาคม 2569")).toBeInTheDocument();
    expect(within(article).queryByText(/3 พฤษภาคม 2569\s+\d{1,2}:\d{2}/)).not.toBeInTheDocument();
    expect(within(article).getByText("ผู้เผยแพร่: งานประชาสัมพันธ์")).toBeInTheDocument();
    expect(within(article).getByText("ผู้เข้าดู 12 ครั้ง")).toBeInTheDocument();
    expect(within(article).queryByText(/ผู้โพสต์:/)).not.toBeInTheDocument();
    expect(within(article).queryByText((text) => text.startsWith("เผยแพร่:"))).not.toBeInTheDocument();
    expect(within(article).queryByText(/อัปเดต:/)).not.toBeInTheDocument();
    expect(within(article).getByText("เอกสารแนบ")).toBeInTheDocument();
    expect(within(article).getByRole("link", { name: "ใบสมัคร.pdf" })).toBeInTheDocument();

    const articleText = article.textContent || "";
    expect(articleText.indexOf("ผู้เผยแพร่: งานประชาสัมพันธ์")).toBeLessThan(articleText.indexOf("ประกาศรับสมัคร"));
    expect(articleText.indexOf("ประกาศรับสมัคร")).toBeLessThan(articleText.indexOf("เนื้อหาประกาศ"));
    expect(articleText.indexOf("เนื้อหาประกาศ")).toBeLessThan(articleText.indexOf("เอกสารแนบ"));

    const tagLink = within(article).getByText("#รับสมัคร").closest("a");

    expect(tagLink?.getAttribute("href")).toBe(
      "/announcements?tag=%E0%B8%A3%E0%B8%B1%E0%B8%9A%E0%B8%AA%E0%B8%A1%E0%B8%B1%E0%B8%84%E0%B8%A3"
    );
    expect(within(article).queryByText("งานทะเบียน")).not.toBeInTheDocument();

    await waitFor(() =>
      expect(siteViewMocks.recordContentView).toHaveBeenCalledWith({
        id: "content-1",
        slug: "announcement-1"
      })
    );
    expect(await within(article).findByText("ผู้เข้าดู 13 ครั้ง")).toBeInTheDocument();
    expect(window.localStorage.getItem("rcat.cms.viewed.content-1")).toMatch(/^\d+$/);
  }, 10_000);

  it("uses full Thai date without update or time metadata for announcements", () => {
    currentDetail = createContent({
      updatedAt: "2026-05-03T08:00:00.000Z",
      publishAt: "2026-05-03T08:00:00.000Z"
    });
    currentSnapshot = createSnapshot(currentDetail);
    window.localStorage.setItem("rcat.cms.viewed.content-1", String(Date.now()));

    render(<PublicContentDetailPage slug="announcement-1" />);

    const article = screen.getByRole("article");
    expect(within(article).getByText("3 พฤษภาคม 2569")).toBeInTheDocument();
    expect(within(article).queryByText(/3 พฤษภาคม 2569\s+\d{1,2}:\d{2}/)).not.toBeInTheDocument();
    expect(within(article).queryByText((text) => text.startsWith("เผยแพร่:"))).not.toBeInTheDocument();
    expect(within(article).queryByText(/อัปเดต:/)).not.toBeInTheDocument();
  });

  it("does not debounce failed content view attempts", async () => {
    siteViewMocks.recordContentView.mockRejectedValueOnce(new Error("offline"));
    currentDetail = createContent();
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="announcement-1" />);

    await waitFor(() =>
      expect(siteViewMocks.recordContentView).toHaveBeenCalledWith({
        id: "content-1",
        slug: "announcement-1"
      })
    );
    expect(window.localStorage.getItem("rcat.cms.viewed.content-1")).toBeNull();
  });

  it("removes the generic sidebar for non-announcement content", async () => {
    currentDetail = createContent({
      type: "news",
      title: "ข่าวกิจกรรม",
      slug: "news-1",
      tags: ["ข่าวกิจกรรม"],
      category: "กิจกรรม"
    });
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="news-1" />);
    const article = screen.getByRole("article");

    expect(screen.queryByText("รายละเอียดเนื้อหา")).not.toBeInTheDocument();
    expect(screen.queryByText("ผู้รับผิดชอบ")).not.toBeInTheDocument();
    expect(screen.queryByText("ปรับปรุงล่าสุด")).not.toBeInTheDocument();
    expect(screen.queryByText("เผยแพร่")).not.toBeInTheDocument();
    expect(screen.queryByText("เทมเพลต")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "URL หลัก" })).not.toBeInTheDocument();
    expect(screen.getByText("ข่าว")).toBeInTheDocument();
    expect(screen.getByText("เผยแพร่แล้ว")).toBeInTheDocument();
    expect(screen.getByText("3 พฤษภาคม 2569")).toBeInTheDocument();
    expect(screen.queryByText(/3 พฤษภาคม 2569\s+\d{1,2}:\d{2}/)).not.toBeInTheDocument();
    expect(screen.getByText("ผู้เผยแพร่: งานประชาสัมพันธ์")).toBeInTheDocument();
    expect(screen.getByText("ผู้เข้าดู 12 ครั้ง")).toBeInTheDocument();
    expect(within(article).getByText("สื่อแนบ")).toBeInTheDocument();
    expect(within(article).getByRole("link", { name: "ใบสมัคร.pdf" })).toBeInTheDocument();
    expect(within(article).queryByRole("link", { name: "กลับไปหน้ารายการ" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "กลับไปหน้ารายการ" })).toBeInTheDocument();
    expect(screen.getByText("#ข่าวกิจกรรม").closest("a")?.getAttribute("href")).toBe(
      "/news?tag=%E0%B8%82%E0%B9%88%E0%B8%B2%E0%B8%A7%E0%B8%81%E0%B8%B4%E0%B8%88%E0%B8%81%E0%B8%A3%E0%B8%A3%E0%B8%A1"
    );
    expect(screen.queryByText("กิจกรรม")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(siteViewMocks.recordContentView).toHaveBeenCalledWith({
        id: "content-1",
        slug: "news-1"
      })
    );
  });
});
