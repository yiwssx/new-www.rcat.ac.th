import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicSiteShell from "../public/components/PublicSiteShell";
import PublicAnnouncementsPage from "../public/pages/PublicAnnouncementsPage";
import PublicHomePage from "../public/pages/PublicHomePage";
import { defaultSiteSettings } from "../services/siteSettings";
import { CmsSnapshot } from "../types";

let currentSnapshot: CmsSnapshot | undefined;
let currentQueryState = {
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn()
};

vi.mock("../public/hooks/usePublicCmsSnapshot", () => ({
  usePublicCmsSnapshot: () => ({
    data: currentSnapshot,
    ...currentQueryState
  })
}));

function createSnapshot(overrides: Partial<CmsSnapshot> = {}): CmsSnapshot {
  return {
    metrics: [],
    content: [],
    media: [],
    events: [],
    menu: [],
    siteSettings: {
      siteName: "CMS public site",
      eyebrow: "",
      intro: "",
      campus: "",
      phone: "",
      fax: "",
      email: "",
      address: "",
      admissionUrl: "",
      facebookUrl: "",
      youtubeUrl: "",
      tiktokUrl: "",
      heroTitle: "CMS public site",
      heroDescription: "",
      heroChip: "",
      heroImageUrl: "",
      directorName: "",
      directorTitle: "",
      directorDescription: "",
      directorImageUrl: "",
      mapUrl: "",
      mapEmbedUrl: "",
      footerTitle: "CMS public site",
      footerDescription: ""
    },
    ...overrides
  };
}

beforeEach(() => {
  currentSnapshot = createSnapshot();
  currentQueryState = {
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn()
  };
});

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

describe("public data-driven pages", () => {
  it("shows the public loading state before a snapshot is available", () => {
    currentSnapshot = undefined;
    currentQueryState = {
      ...currentQueryState,
      isLoading: true
    };

    render(
      <PublicSiteShell>
        <div>Loaded content</div>
      </PublicSiteShell>
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("กำลังโหลดข้อมูล");
    expect(status).toHaveTextContent("กรุณารอสักครู่ ระบบกำลังดึงข้อมูลเว็บไซต์");
    expect(screen.queryByText(defaultSiteSettings.siteName)).not.toBeInTheDocument();
    expect(screen.queryByText("Loaded content")).not.toBeInTheDocument();
  });

  it("renders cached public data while a snapshot refresh is fetching", () => {
    currentSnapshot = createSnapshot({
      siteSettings: {
        ...createSnapshot().siteSettings!,
        siteName: "Cached CMS site",
        heroTitle: "Cached CMS site",
        footerTitle: "Cached CMS site"
      }
    });
    currentQueryState = {
      ...currentQueryState,
      isFetching: true
    };

    render(
      <PublicSiteShell>
        <div>Cached content</div>
      </PublicSiteShell>
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getAllByText("Cached CMS site").length).toBeGreaterThan(0);
    expect(screen.getByText("Cached content")).toBeInTheDocument();
  });

  it("shows the public error state when the snapshot fails without cached data", () => {
    currentSnapshot = undefined;
    currentQueryState = {
      ...currentQueryState,
      isError: true
    };

    render(
      <PublicSiteShell>
        <div>Loaded content</div>
      </PublicSiteShell>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("ไม่สามารถโหลดข้อมูลได้");
    expect(screen.getByText("กรุณาลองใหม่อีกครั้ง")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ลองอีกครั้ง" })).toBeInTheDocument();
    expect(screen.queryByText(defaultSiteSettings.siteName)).not.toBeInTheDocument();
    expect(screen.queryByText("Loaded content")).not.toBeInTheDocument();
  });

  it("does not show homepage empty states during initial snapshot loading", () => {
    currentSnapshot = undefined;
    currentQueryState = {
      ...currentQueryState,
      isLoading: true
    };

    render(<PublicHomePage />);

    expect(screen.getByRole("status")).toHaveTextContent("กำลังโหลดข้อมูล");
    expect(document.body).not.toHaveTextContent("ยังไม่มี");
    expect(screen.queryByText(defaultSiteSettings.siteName)).not.toBeInTheDocument();
  });

  it("does not render mock document titles when no CMS content exists", () => {
    currentSnapshot = createSnapshot();

    render(<PublicHomePage />);

    expect(screen.queryByText(/ITA/)).not.toBeInTheDocument();
    expect(screen.queryByText(/แผนปฏิบัติการ/)).not.toBeInTheDocument();
    expect(screen.getByText("ยังไม่มีเอกสารเผยแพร่")).toBeInTheDocument();
  });

  it("shows an honest empty state when no program content exists", () => {
    currentSnapshot = createSnapshot();

    render(<PublicHomePage />);

    expect(screen.getByText("ยังไม่มีข้อมูลหลักสูตรที่เผยแพร่")).toBeInTheDocument();
  });

  it("renders the approved homepage information architecture", () => {
    const baseSiteSettings = createSnapshot().siteSettings!;
    currentSnapshot = createSnapshot({
      content: [
        {
          id: "news-1",
          title: "ข่าวเปิดบ้านวิทยาลัย",
          slug: "open-house",
          type: "news",
          status: "published",
          owner: "Admin",
          summary: "ข่าวประชาสัมพันธ์ล่าสุด",
          updatedAt: "2026-05-03T00:00:00.000Z",
          publishAt: "2026-05-03T00:00:00.000Z"
        },
        {
          id: "program-1",
          title: "หลักสูตรช่างยนต์",
          slug: "auto-program",
          type: "program",
          status: "published",
          owner: "Admin",
          summary: "ข้อมูลหลักสูตร",
          updatedAt: "2026-05-03T00:00:00.000Z",
          publishAt: "2026-05-03T00:00:00.000Z"
        },
        {
          id: "announcement-1",
          title: "ประกาศรับสมัครนักเรียน",
          slug: "admission-announcement",
          type: "announcement",
          status: "published",
          owner: "Admin",
          summary: "ประกาศล่าสุด",
          updatedAt: "2026-05-03T00:00:00.000Z",
          publishAt: "2026-05-03T00:00:00.000Z"
        },
        {
          id: "document-1",
          title: "เอกสารแผนปฏิบัติการ",
          slug: "action-plan",
          type: "page",
          status: "published",
          owner: "Admin",
          summary: "เอกสารเผยแพร่",
          category: "เอกสาร",
          updatedAt: "2026-05-03T00:00:00.000Z",
          publishAt: "2026-05-03T00:00:00.000Z"
        }
      ],
      events: [
        {
          id: "event-1",
          title: "ปฐมนิเทศนักศึกษาใหม่",
          date: "2026-05-20T09:00:00.000Z",
          audience: "public",
          status: "confirmed",
          location: "หอประชุม",
          visibility: "public"
        }
      ],
      siteSettings: {
        ...baseSiteSettings,
        heroTitle: "ยินดีต้อนรับสู่วิทยาลัยตัวอย่าง",
        directorTitle: "สารจากผู้อำนวยการ",
        directorName: "ผู้อำนวยการตัวอย่าง",
        directorDescription: "มุ่งพัฒนาผู้เรียนสู่อาชีพ",
        campus: "วิทยาลัยเทคนิคตัวอย่าง",
        address: "1 ถนนการศึกษา",
        phone: "02-000-0000",
        mapUrl: "https://www.google.com/maps/place/example",
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=test"
      }
    });

    render(<PublicHomePage />);

    const pageText = document.body.textContent || "";
    const heroIndex = pageText.indexOf("ยินดีต้อนรับสู่วิทยาลัยตัวอย่าง");
    const directorIndex = pageText.indexOf("สารจากผู้อำนวยการ");
    const newsIndex = pageText.indexOf("ข่าวสารและกิจกรรมล่าสุด");
    const programsIndex = pageText.indexOf("หลักสูตรที่เปิดสอน");
    const announcementsIndex = pageText.indexOf("ประกาศล่าสุด");
    const eventsIndex = pageText.indexOf("กำหนดการ");
    const documentsIndex = pageText.indexOf("เอกสารเผยแพร่");
    const contactIndex = pageText.indexOf("ติดต่อและแผนที่");

    [
      heroIndex,
      directorIndex,
      newsIndex,
      programsIndex,
      announcementsIndex,
      eventsIndex,
      documentsIndex,
      contactIndex
    ].forEach((index) => expect(index).toBeGreaterThanOrEqual(0));
    expect(heroIndex).toBeLessThan(newsIndex);
    expect(newsIndex).toBeLessThan(programsIndex);
    expect(programsIndex).toBeLessThan(directorIndex);
    expect(directorIndex).toBeLessThan(announcementsIndex);
    expect(announcementsIndex).toBeLessThan(eventsIndex);
    expect(eventsIndex).toBeLessThan(documentsIndex);
    expect(documentsIndex).toBeLessThan(contactIndex);

    expect(screen.getByText("ข่าวเปิดบ้านวิทยาลัย")).toBeInTheDocument();
    expect(screen.getByText("หลักสูตรช่างยนต์")).toBeInTheDocument();
    expect(screen.getByText("ประกาศรับสมัครนักเรียน")).toBeInTheDocument();
    expect(screen.getByText("ปฐมนิเทศนักศึกษาใหม่")).toBeInTheDocument();
    expect(screen.getByText("เอกสารแผนปฏิบัติการ")).toBeInTheDocument();
    expect(screen.getAllByText("กำหนดการ")).toHaveLength(1);
    expect(screen.getAllByText("ปฐมนิเทศนักศึกษาใหม่")).toHaveLength(1);

    const contactSection = screen.getByText("ติดต่อและแผนที่").closest("section") as HTMLElement;
    expect(contactSection).not.toBeNull();
    expect(contactSection).toHaveTextContent("วิทยาลัยเทคนิคตัวอย่าง");
    expect(within(contactSection).getByTitle("แผนที่วิทยาลัย")).toBeInTheDocument();
    expect(within(contactSection).getByRole("link", { name: "เปิดแผนที่ใน Google Maps" }).getAttribute("href")).toBe(
      "https://www.google.com/maps/place/example"
    );
    expect(screen.getAllByText("ติดต่อและแผนที่")).toHaveLength(1);
  });

  it("hides social icons when site settings URLs are empty", () => {
    currentSnapshot = createSnapshot();

    render(
      <PublicSiteShell>
        <div>content</div>
      </PublicSiteShell>
    );

    expect(screen.queryByLabelText("Facebook")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("YouTube")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("TikTok")).not.toBeInTheDocument();
  });

  it("filters announcements by clickable tag query params", () => {
    window.history.pushState({}, "", "/announcements?tag=รับสมัคร");
    currentSnapshot = createSnapshot({
      content: [
        {
          id: "announcement-1",
          title: "ประกาศรับสมัคร",
          slug: "admissions",
          type: "announcement",
          status: "published",
          owner: "Admin",
          summary: "",
          tags: ["รับสมัคร"],
          updatedAt: "2026-05-03T00:00:00.000Z",
          publishAt: "2026-05-03T00:00:00.000Z"
        },
        {
          id: "announcement-2",
          title: "ประกาศทั่วไป",
          slug: "general",
          type: "announcement",
          status: "published",
          owner: "Admin",
          summary: "",
          tags: ["ทั่วไป"],
          updatedAt: "2026-05-03T00:00:00.000Z",
          publishAt: "2026-05-03T00:00:00.000Z"
        }
      ]
    });

    render(<PublicAnnouncementsPage />);

    expect(screen.getByText("ประกาศรับสมัคร")).toBeInTheDocument();
    expect(screen.queryByText("ประกาศทั่วไป")).not.toBeInTheDocument();
    expect(screen.getAllByText("#รับสมัคร")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "ล้างตัวกรอง" }).getAttribute("href")).toBe("/announcements");
  });
});
