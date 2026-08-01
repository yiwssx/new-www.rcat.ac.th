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

    expect(article).toHaveAttribute("data-content-template", "standard");

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

  it("uses the Bangkok calendar date at the UTC date boundary", () => {
    currentDetail = createContent({
      publishAt: "2026-07-31T17:30:00.000Z"
    });
    currentSnapshot = createSnapshot(currentDetail);
    window.localStorage.setItem("rcat.cms.viewed.content-1", String(Date.now()));

    render(<PublicContentDetailPage slug="announcement-1" />);

    expect(within(screen.getByRole("article")).getByText("1 สิงหาคม 2569")).toBeInTheDocument();
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

    expect(article).toHaveAttribute("data-content-template", "standard");
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

  it("renders facebook-embed content as the original Facebook post instead of article body text", () => {
    window.localStorage.setItem("rcat.cms.viewed.content-1", String(Date.now()));
    currentDetail = createContent({
      type: "news",
      title: "ข่าวกิจกรรมจาก Facebook",
      slug: "facebook-news-1",
      template: "facebook-embed",
      canonicalUrl: facebookPostUrl,
      body: "ข้อความโพสต์ Facebook ต้นฉบับที่ไม่ควรถูกแสดงเป็นบทความยาว",
      category: "กิจกรรม",
      summary: "สรุปข่าวกิจกรรมจาก Facebook"
    });
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="facebook-news-1" />);

    const iframe = screen.getByTitle("โพสต์ Facebook: ข่าวกิจกรรมจาก Facebook");
    const pluginUrl = new URL(iframe.getAttribute("src") || "");
    const article = screen.getByRole("article");

    expect(article).toHaveAttribute("data-content-template", "facebook-embed");
    expect(pluginUrl.origin + pluginUrl.pathname).toBe("https://www.facebook.com/plugins/post.php");
    expect(pluginUrl.searchParams.get("href")).toBe(facebookPostUrl);
    expect(screen.getByText("Facebook")).toBeInTheDocument();
    expect(screen.getByText("กิจกรรม")).toBeInTheDocument();
    expect(screen.getByText("สรุปข่าวกิจกรรมจาก Facebook")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิดโพสต์ต้นทางบน Facebook" })).toHaveAttribute("href", facebookPostUrl);
    expect(screen.queryByText("ข้อความโพสต์ Facebook ต้นฉบับที่ไม่ควรถูกแสดงเป็นบทความยาว")).not.toBeInTheDocument();
  });

  it("keeps explicit standard authoritative for a Facebook URL and preserves SEO metadata", () => {
    window.localStorage.setItem("rcat.cms.viewed.content-1", String(Date.now()));
    currentDetail = createContent({
      type: "news",
      title: "ข่าวจาก canonical URL",
      slug: "facebook-canonical-news",
      template: "standard",
      canonicalUrl: facebookPostUrl,
      body: "เนื้อหาปกติที่ต้องแสดงแม้ canonical URL เป็น Facebook",
      seoTitle: "ชื่อ SEO สำหรับข่าวมาตรฐาน",
      seoDescription: "คำอธิบาย SEO สำหรับข่าวมาตรฐาน"
    });
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="facebook-canonical-news" />);

    expect(screen.getByRole("article")).toHaveAttribute("data-content-template", "standard");
    expect(screen.getByText("เนื้อหาปกติที่ต้องแสดงแม้ canonical URL เป็น Facebook")).toBeInTheDocument();
    expect(screen.queryByTitle("โพสต์ Facebook: ข่าวจาก canonical URL")).not.toBeInTheDocument();
    expect(document.title).toContain("ชื่อ SEO สำหรับข่าวมาตรฐาน");
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      "content",
      "คำอธิบาย SEO สำหรับข่าวมาตรฐาน"
    );
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute("href", facebookPostUrl);
  });

  it("uses the Facebook URL fallback only for a blank legacy template", () => {
    window.localStorage.setItem("rcat.cms.viewed.content-1", String(Date.now()));
    currentDetail = createContent({
      type: "news",
      title: "ข่าว Facebook แบบเดิม",
      slug: "legacy-facebook-news",
      template: " ",
      canonicalUrl: facebookPostUrl,
      body: "เนื้อหาเดิมที่ไม่ควรแสดงแทนโพสต์ฝัง"
    });
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="legacy-facebook-news" />);

    expect(screen.getByRole("article")).toHaveAttribute("data-content-template", "facebook-embed");
    expect(screen.getByTitle("โพสต์ Facebook: ข่าว Facebook แบบเดิม")).toBeInTheDocument();
    expect(screen.queryByText("เนื้อหาเดิมที่ไม่ควรแสดงแทนโพสต์ฝัง")).not.toBeInTheDocument();
  });

  it("renders the feature layout in hero-first semantic order", () => {
    window.localStorage.setItem("rcat.cms.viewed.content-1", String(Date.now()));
    const featuredImage = createFeaturedImage();
    currentDetail = createContent({
      type: "news",
      title: "หัวข้อเนื้อหาเด่น",
      slug: "feature-news",
      template: "feature",
      summary: "สรุปเนื้อหาเด่น",
      body: "เนื้อหาหลักของเรื่องเด่น",
      featuredMediaId: featuredImage.id,
      mediaIds: ["media-1"]
    });
    currentSnapshot = createSnapshot(currentDetail, [featuredImage]);

    render(<PublicContentDetailPage slug="feature-news" />);

    const article = screen.getByRole("article");
    const heading = within(article).getByRole("heading", { level: 1, name: "หัวข้อเนื้อหาเด่น" });
    const summary = within(article).getByText("สรุปเนื้อหาเด่น");
    const image = within(article).getByRole("img", { name: featuredImage.name });
    const metadata = within(article).getByText("ผู้เผยแพร่: งานประชาสัมพันธ์");
    const body = within(article).getByText("เนื้อหาหลักของเรื่องเด่น");
    const attachments = within(article).getByText("สื่อแนบ");

    expect(article).toHaveAttribute("data-content-template", "feature");
    expect(image).toHaveAttribute("src", featuredImage.previewUrl);
    expectElementsInOrder([heading, summary, image, metadata, body, attachments]);
    expect(screen.getByRole("link", { name: "กลับไปหน้ารายการ" })).toBeInTheDocument();
  });

  it("renders the compact update layout with media after the body", () => {
    window.localStorage.setItem("rcat.cms.viewed.content-1", String(Date.now()));
    const featuredImage = createFeaturedImage();
    currentDetail = createContent({
      type: "news",
      title: "หัวข้อข่าวอัปเดต",
      slug: "update-news",
      template: "update",
      summary: "สรุปข่าวอัปเดต",
      body: "รายละเอียดข่าวอัปเดต",
      featuredMediaId: featuredImage.id,
      mediaIds: ["media-1"]
    });
    currentSnapshot = createSnapshot(currentDetail, [featuredImage]);

    render(<PublicContentDetailPage slug="update-news" />);

    const article = screen.getByRole("article");
    const indicator = within(article).getByText("อัปเดต");
    const metadata = within(article).getByText("ผู้เผยแพร่: งานประชาสัมพันธ์");
    const heading = within(article).getByRole("heading", { level: 1, name: "หัวข้อข่าวอัปเดต" });
    const summary = within(article).getByText("สรุปข่าวอัปเดต");
    const body = within(article).getByText("รายละเอียดข่าวอัปเดต");
    const image = within(article).getByRole("img", { name: featuredImage.name });
    const attachments = within(article).getByText("สื่อแนบ");

    expect(article).toHaveAttribute("data-content-template", "update");
    expectElementsInOrder([indicator, metadata, heading, summary, body, image, attachments]);
  });

  it.each(["feature", "update"])(
    "uses the selected %s layout for announcements instead of the standard announcement renderer",
    (template) => {
      window.localStorage.setItem("rcat.cms.viewed.content-1", String(Date.now()));
      currentDetail = createContent({ template });
      currentSnapshot = createSnapshot(currentDetail);

      render(<PublicContentDetailPage slug="announcement-1" />);

      const article = screen.getByRole("article");
      expect(article).toHaveAttribute("data-content-template", template);
      expect(within(article).getByRole("heading", { level: 1, name: "ประกาศรับสมัคร" })).toBeInTheDocument();
      expect(within(article).getByText("สื่อแนบ")).toBeInTheDocument();
      expect(within(article).queryByText("เอกสารแนบ")).not.toBeInTheDocument();
    }
  );

  it.each(["feature", "update"])("does not render an empty featured-media placeholder for %s", (template) => {
    window.localStorage.setItem("rcat.cms.viewed.content-1", String(Date.now()));
    currentDetail = createContent({
      type: "news",
      template,
      featuredMediaId: "",
      mediaIds: []
    });
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="announcement-1" />);

    const article = screen.getByRole("article");
    expect(article).toHaveAttribute("data-content-template", template);
    expect(within(article).queryByRole("img")).not.toBeInTheDocument();
    expect(within(article).queryByTitle("ภาพเด่นของบทความ")).not.toBeInTheDocument();
  });

  it.each(["standard", "feature", "update", "facebook-embed"])(
    "records one view for published %s content",
    async (template) => {
      currentDetail = createContent({
        id: `content-${template}`,
        slug: `content-${template}`,
        type: "news",
        template,
        canonicalUrl: template === "facebook-embed" ? facebookPostUrl : ""
      });
      currentSnapshot = createSnapshot(currentDetail);

      render(<PublicContentDetailPage slug={currentDetail.slug} />);

      await waitFor(() => expect(siteViewMocks.recordContentView).toHaveBeenCalledTimes(1));
      expect(siteViewMocks.recordContentView).toHaveBeenCalledWith({
        id: `content-${template}`,
        slug: `content-${template}`
      });
    }
  );

  it("shows a Facebook embed fallback when imported content is missing canonical_url", () => {
    window.localStorage.setItem("rcat.cms.viewed.content-1", String(Date.now()));
    currentDetail = createContent({
      type: "news",
      title: "ข่าว Facebook ไม่มี URL",
      slug: "facebook-missing-url",
      template: "facebook-embed",
      canonicalUrl: "",
      body: "โพสต์นี้แสดงจาก Facebook ต้นฉบับ\n\nที่มา:",
      summary: "สรุปข่าว Facebook ไม่มี URL"
    });
    currentSnapshot = createSnapshot(currentDetail);

    render(<PublicContentDetailPage slug="facebook-missing-url" />);

    expect(screen.getByRole("article")).toHaveAttribute("data-content-template", "facebook-embed");
    expect(screen.getByText("ไม่สามารถแสดงโพสต์ Facebook แบบฝังได้")).toBeInTheDocument();
    expect(screen.queryByTitle("โพสต์ Facebook: ข่าว Facebook ไม่มี URL")).not.toBeInTheDocument();
    expect(screen.getByText("สรุปข่าว Facebook ไม่มี URL")).toBeInTheDocument();
  });
});
