import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicSiteShell from "../public/components/PublicSiteShell";
import PublicAnnouncementsPage from "../public/pages/PublicAnnouncementsPage";
import PublicHomePage from "../public/pages/PublicHomePage";
import { CmsSnapshot } from "../types";

let currentSnapshot: CmsSnapshot;

vi.mock("../public/hooks/usePublicCmsSnapshot", () => ({
  usePublicCmsSnapshot: () => ({
    data: currentSnapshot,
    isLoading: false
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

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

describe("public data-driven pages", () => {
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

  it("orders homepage programs under news and events under announcements", () => {
    currentSnapshot = createSnapshot();

    render(<PublicHomePage />);

    const pageText = document.body.textContent || "";
    expect(pageText.indexOf("ข่าวสารและกิจกรรมล่าสุด")).toBeLessThan(pageText.indexOf("หลักสูตรที่เปิดสอน"));
    expect(pageText.indexOf("ประกาศล่าสุด")).toBeLessThan(pageText.indexOf("กำหนดการ"));
    expect(pageText.indexOf("กำหนดการ")).toBeLessThan(pageText.indexOf("เอกสารเผยแพร่"));
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
    expect(screen.getByText("#รับสมัคร")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ล้างตัวกรอง" }).getAttribute("href")).toBe("/announcements");
  });
});
