import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicContentDetailPage from "../public/pages/PublicContentDetailPage";
import { CmsSnapshot, ContentItem, MediaAsset } from "../types";

const siteViewMocks = vi.hoisted(() => ({
  recordContentView: vi.fn()
}));
const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn()
}));
const facebookPostUrl = "https://www.facebook.com/100063746585360/posts/111";

let currentSnapshot: CmsSnapshot | undefined;
let currentDetail: ContentItem | null | undefined;
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

vi.mock("../public/hooks/usePublicShellSnapshot", () => ({
  usePublicShellSnapshot: () => ({
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

function createSnapshot(content: ContentItem, additionalMedia: MediaAsset[] = []): CmsSnapshot {
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
      },
      ...additionalMedia
    ],
    events: [],
    menu: []
  };
}

function createFeaturedImage(): MediaAsset {
  return {
    id: "media-featured",
    name: "ภาพเด่นของบทความ",
    type: "image",
    size: "1 MB",
    owner: "งานประชาสัมพันธ์",
    driveUrl: "https://drive.google.com/file/d/media-featured/view",
    previewUrl: "https://example.edu/featured-image.jpg",
    updatedAt: "2026-05-03T09:30:00.000Z"
  };
}

function expectElementsInOrder(elements: Element[]) {
  elements.slice(0, -1).forEach((element, index) => {
    expect(element.compareDocumentPosition(elements[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });
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

  it("renders not found without stale content, embeds, or view tracking after confirmed deletion", () => {
    const deletedContent = createContent({
      title: "ข่าวที่ถูกลบ",
      slug: "deleted-facebook-news",
      template: "facebook-embed",
      canonicalUrl: facebookPostUrl,
      body: "เนื้อหาเก่าที่ต้องไม่แสดง"
    });
    currentSnapshot = createSnapshot(deletedContent);
    currentDetail = null;

    render(<PublicContentDetailPage slug={deletedContent.slug} />);

    expect(screen.getByText("ไม่พบเนื้อหา")).toBeInTheDocument();
    expect(screen.getByText("เนื้อหาอาจยังไม่เผยแพร่ ถูกย้าย หรือไม่พร้อมให้แสดงต่อสาธารณะ")).toBeInTheDocument();
    expect(screen.queryByText(deletedContent.title)).not.toBeInTheDocument();
    expect(screen.queryByText(deletedContent.body || "")).not.toBeInTheDocument();
    expect(screen.queryByTitle(`โพสต์ Facebook: ${deletedContent.title}`)).not.toBeInTheDocument();
    expect(siteViewMocks.recordContentView).not.toHaveBeenCalled();
  });

  it("renders announcements as an article without the generic detail sidebar", async () => {
    currentDetail = createContent();
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="announcement-1" />);

    const article = screen.getByRole("article");
    expect(within(article).getByText("ประกาศรับสมัคร")).toBeInTheDocument();
    expect(screen.queryByText("รายละเอียดเนื้อหา")).not.toBeInTheDocument();
    await waitFor(() => expect(siteViewMocks.recordContentView).toHaveBeenCalledTimes(1));
  });

  it("uses full Thai date without update or time metadata for announcements", () => {
    currentDetail = createContent();
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="announcement-1" />);

    const article = screen.getByRole("article");
    expect(within(article).getByText("3 พฤษภาคม 2569")).toBeInTheDocument();
    expect(within(article).queryByText(/ปรับปรุงล่าสุด/)).not.toBeInTheDocument();
  });

  it("uses the Bangkok calendar date at the UTC date boundary", () => {
    currentDetail = createContent({
      publishAt: "2026-05-03T18:30:00.000Z"
    });
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="announcement-1" />);

    expect(within(screen.getByRole("article")).getByText("4 พฤษภาคม 2569")).toBeInTheDocument();
  });

  it("does not debounce failed content view attempts", async () => {
    siteViewMocks.recordContentView.mockRejectedValue(new Error("network"));
    currentDetail = createContent({ id: "content-failed-view", slug: "failed-view" });
    currentSnapshot = createSnapshot(currentDetail);

    const first = render(<PublicContentDetailPage slug="failed-view" />);
    await waitFor(() => expect(siteViewMocks.recordContentView).toHaveBeenCalledTimes(1));
    first.unmount();

    render(<PublicContentDetailPage slug="failed-view" />);
    await waitFor(() => expect(siteViewMocks.recordContentView).toHaveBeenCalledTimes(2));
  });

  it("removes the generic sidebar for non-announcement content", () => {
    currentDetail = createContent({ type: "news", title: "ข่าวประชาสัมพันธ์" });
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="announcement-1" />);

    expect(screen.queryByText("รายละเอียดเนื้อหา")).not.toBeInTheDocument();
  });

  it("renders facebook-embed content as the original Facebook post instead of article body text", () => {
    currentDetail = createContent({
      type: "news",
      title: "ข่าวจาก Facebook",
      template: "facebook-embed",
      canonicalUrl: facebookPostUrl,
      body: "ข้อความสำรองที่ไม่ควรแสดง"
    });
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="announcement-1" />);

    expect(screen.getByTitle("โพสต์ Facebook: ข่าวจาก Facebook")).toBeInTheDocument();
    expect(screen.queryByText("ข้อความสำรองที่ไม่ควรแสดง")).not.toBeInTheDocument();
  });

  it("keeps explicit standard authoritative for a Facebook URL and preserves SEO metadata", () => {
    currentDetail = createContent({
      type: "news",
      title: "ข่าวมาตรฐาน",
      template: "standard",
      canonicalUrl: facebookPostUrl,
      body: "เนื้อหามาตรฐาน",
      seoTitle: "SEO ข่าวมาตรฐาน",
      seoDescription: "คำอธิบาย SEO"
    });
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="announcement-1" />);

    expect(screen.getByText("เนื้อหามาตรฐาน")).toBeInTheDocument();
    expect(screen.queryByTitle("โพสต์ Facebook: ข่าวมาตรฐาน")).not.toBeInTheDocument();
  });

  it("uses the Facebook URL fallback only for a blank legacy template", () => {
    currentDetail = createContent({
      type: "news",
      title: "ข่าวเก่า Facebook",
      template: "",
      canonicalUrl: facebookPostUrl,
      body: "ข้อความเก่า"
    });
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="announcement-1" />);

    expect(screen.getByTitle("โพสต์ Facebook: ข่าวเก่า Facebook")).toBeInTheDocument();
  });

  it("renders the feature layout in hero-first semantic order", () => {
    const featuredImage = createFeaturedImage();
    currentDetail = createContent({
      type: "news",
      title: "ข่าวเด่น",
      template: "feature",
      featuredMediaId: featuredImage.id,
      mediaIds: [featuredImage.id]
    });
    currentSnapshot = createSnapshot(currentDetail, [featuredImage]);

    render(<PublicContentDetailPage slug="announcement-1" />);

    const article = screen.getByRole("article");
    const image = within(article).getByAltText("ภาพเด่นของบทความ");
    const title = within(article).getByRole("heading", { name: "ข่าวเด่น" });
    expectElementsInOrder([image, title]);
  });

  it("renders the compact update layout with media after the body", () => {
    const featuredImage = createFeaturedImage();
    currentDetail = createContent({
      type: "news",
      title: "อัปเดตล่าสุด",
      template: "update",
      featuredMediaId: featuredImage.id,
      mediaIds: [featuredImage.id]
    });
    currentSnapshot = createSnapshot(currentDetail, [featuredImage]);

    render(<PublicContentDetailPage slug="announcement-1" />);

    const article = screen.getByRole("article");
    const body = within(article).getByText("เนื้อหาประกาศ");
    const image = within(article).getByAltText("ภาพเด่นของบทความ");
    expectElementsInOrder([body, image]);
  });

  it("uses the selected feature layout for announcements instead of the standard announcement renderer", () => {
    const featuredImage = createFeaturedImage();
    currentDetail = createContent({ template: "feature", featuredMediaId: featuredImage.id, mediaIds: [featuredImage.id] });
    currentSnapshot = createSnapshot(currentDetail, [featuredImage]);

    render(<PublicContentDetailPage slug="announcement-1" />);

    expect(screen.getByAltText("ภาพเด่นของบทความ")).toBeInTheDocument();
  });

  it("uses the selected update layout for announcements instead of the standard announcement renderer", () => {
    const featuredImage = createFeaturedImage();
    currentDetail = createContent({ template: "update", featuredMediaId: featuredImage.id, mediaIds: [featuredImage.id] });
    currentSnapshot = createSnapshot(currentDetail, [featuredImage]);

    render(<PublicContentDetailPage slug="announcement-1" />);

    expect(screen.getByAltText("ภาพเด่นของบทความ")).toBeInTheDocument();
  });

  it("does not render an empty featured-media placeholder for feature", () => {
    currentDetail = createContent({ template: "feature", featuredMediaId: "", mediaIds: [] });
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="announcement-1" />);

    expect(screen.queryByText("ไม่พบภาพประกอบ")).not.toBeInTheDocument();
  });

  it("does not render an empty featured-media placeholder for update", () => {
    currentDetail = createContent({ template: "update", featuredMediaId: "", mediaIds: [] });
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="announcement-1" />);

    expect(screen.queryByText("ไม่พบภาพประกอบ")).not.toBeInTheDocument();
  });

  for (const template of ["standard", "feature", "update", "facebook-embed"] as const) {
    it(`records one view for published ${template} content`, async () => {
      currentDetail = createContent({ template });
      currentSnapshot = createSnapshot(currentDetail);

      render(<PublicContentDetailPage slug="announcement-1" />);

      await waitFor(() => expect(siteViewMocks.recordContentView).toHaveBeenCalledTimes(1));
    });
  }

  it("shows a Facebook embed fallback when imported content is missing canonical_url", () => {
    currentDetail = createContent({
      type: "news",
      title: "ข่าว Facebook ที่ URL หาย",
      template: "facebook-embed",
      canonicalUrl: "",
      body: ""
    });
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="announcement-1" />);

    expect(screen.getByText(/ไม่สามารถแสดงโพสต์ Facebook/)).toBeInTheDocument();
  });
});
