import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicSiteShell from "../public/components/PublicSiteShell";
import PublicAnnouncementsPage from "../public/pages/PublicAnnouncementsPage";
import PublicDepartmentsPage from "../public/pages/PublicDepartmentsPage";
import PublicHomePage from "../public/pages/PublicHomePage";
import { projectSettings } from "../config/projectSettings";
import { defaultSiteSettings } from "../services/siteSettings";
import { CmsSnapshot, PublicContentListSnapshot, PublicHomeSnapshot, PublicProgramListSnapshot } from "../types";

const usePublicCmsSnapshotMock = vi.hoisted(() => vi.fn());

let currentSnapshot: CmsSnapshot | undefined;
let currentHomeSnapshot: PublicHomeSnapshot | undefined;
let currentContentListSnapshot: PublicContentListSnapshot | undefined;
let currentProgramListSnapshot: PublicProgramListSnapshot | undefined;
let currentQueryState = {
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn()
};
let currentHomeQueryState = {
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn()
};
let currentContentListQueryState = {
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn()
};
let currentProgramListQueryState = {
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn()
};

vi.mock("../public/hooks/usePublicCmsSnapshot", () => ({
  usePublicCmsSnapshot: (options?: { enabled?: boolean }) => {
    usePublicCmsSnapshotMock(options);

    return {
      data: currentSnapshot,
      ...currentQueryState
    };
  }
}));

vi.mock("../public/hooks/usePublicHomeSnapshot", () => ({
  usePublicHomeSnapshot: () => ({
    data: currentHomeSnapshot,
    ...currentHomeQueryState
  })
}));

vi.mock("../public/hooks/usePublicContentList", () => ({
  usePublicContentList: () => ({
    data: currentContentListSnapshot,
    ...currentContentListQueryState
  })
}));

vi.mock("../public/hooks/usePublicProgramList", () => ({
  usePublicProgramList: () => ({
    data: currentProgramListSnapshot,
    ...currentProgramListQueryState
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
      ...defaultSiteSettings,
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

function createHomeSnapshot(overrides: Partial<PublicHomeSnapshot> = {}): PublicHomeSnapshot {
  const snapshot = createSnapshot();

  return {
    siteSettings: snapshot.siteSettings!,
    homepageSettings: {
      carousel: {
        autoplayEnabled: true,
        autoplayIntervalSeconds: 5
      },
      introGate: {
        enabled: false,
        imageUrl: "",
        imageAlt: "ภาพหน้าแนะนำก่อนเข้าสู่เว็บไซต์",
        primaryButtonLabel: "เข้าสู่เว็บไซต์หลัก",
        secondaryButtonLabel: "",
        secondaryButtonUrl: "",
        storageKey: "public-intro-gate"
      },
      marquee: {
        enabled: false,
        label: "ประชาสัมพันธ์",
        text: "",
        speedSeconds: 32
      },
      introVideo: {
        enabled: false,
        title: "วีดิทัศน์แนะนำสถานศึกษา",
        youtubeEmbedUrl: ""
      }
    },
    displaySettings: snapshot.displaySettings,
    menu: snapshot.menu ?? [],
    carouselSlides: snapshot.carouselSlides ?? [],
    externalServices: snapshot.externalServices ?? [],
    visitorStats: {
      enabled: false,
      usersToday: 0,
      usersYesterday: 0,
      usersThisMonth: 0,
      usersThisYear: 0,
      totalUsers: 0,
      totalViews: 0,
      onlineUsers: 0,
      updatedAt: ""
    },
    latestNews: [],
    latestAnnouncements: [],
    procurementItems: [],
    jobOpportunityItems: [],
    achievementItems: [],
    programItems: [],
    documentItems: [],
    eventItems: [],
    media: [],
    generatedAt: "2026-05-12T00:00:00.000Z",
    ...overrides
  };
}

function createContentListSnapshot(overrides: Partial<PublicContentListSnapshot> = {}): PublicContentListSnapshot {
  const snapshot = createSnapshot();

  return {
    kind: "announcements",
    items: [],
    pageItems: [],
    media: [],
    siteSettings: snapshot.siteSettings!,
    homepageSettings: createHomeSnapshot().homepageSettings,
    displaySettings: snapshot.displaySettings,
    menu: snapshot.menu ?? [],
    generatedAt: "2026-05-12T00:00:00.000Z",
    ...overrides
  };
}

function createProgramListSnapshot(overrides: Partial<PublicProgramListSnapshot> = {}): PublicProgramListSnapshot {
  const snapshot = createSnapshot();

  return {
    items: [],
    media: [],
    siteSettings: snapshot.siteSettings!,
    homepageSettings: createHomeSnapshot().homepageSettings,
    displaySettings: snapshot.displaySettings,
    menu: snapshot.menu ?? [],
    generatedAt: "2026-05-12T00:00:00.000Z",
    ...overrides
  };
}

beforeEach(() => {
  currentSnapshot = createSnapshot();
  currentHomeSnapshot = createHomeSnapshot();
  currentContentListSnapshot = createContentListSnapshot();
  currentProgramListSnapshot = createProgramListSnapshot();
  currentQueryState = {
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn()
  };
  currentHomeQueryState = {
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn()
  };
  currentContentListQueryState = {
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn()
  };
  currentProgramListQueryState = {
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn()
  };
  usePublicCmsSnapshotMock.mockClear();
});

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

describe("public data-driven pages", () => {
  it("renders the public shell instead of the full-screen loading card before a snapshot is available", () => {
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

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("กำลังเชื่อมต่อระบบฐานข้อมูล");
    expect(screen.getAllByText(projectSettings.site.name).length).toBeGreaterThan(0);
    expect(screen.getByText("Loaded content")).toBeInTheDocument();
    expect(document.title).not.toContain("กำลังโหลดข้อมูล");
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
    currentHomeSnapshot = undefined;
    currentHomeQueryState = {
      ...currentHomeQueryState,
      isLoading: true
    };

    render(<PublicHomePage />);

    expect(screen.getByRole("status")).not.toHaveTextContent("กำลังโหลดข้อมูล");
    expect(document.body).not.toHaveTextContent("กำลังเชื่อมต่อระบบฐานข้อมูล");
    expect(screen.queryByText("ยังไม่มีเอกสารเผยแพร่")).not.toBeInTheDocument();
    expect(screen.getAllByText("CMS public site").length).toBeGreaterThan(0);
    expect(usePublicCmsSnapshotMock.mock.calls.every(([options]) => options?.enabled === false)).toBe(true);
  });

  it("does not render mock document titles when no CMS content exists", async () => {
    currentHomeSnapshot = createHomeSnapshot();

    render(<PublicHomePage />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText(/ITA/)).not.toBeInTheDocument();
    expect(screen.queryByText(/แผนปฏิบัติการ/)).not.toBeInTheDocument();
    expect(await screen.findByText("ยังไม่มีเอกสารเผยแพร่", undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it("renders homepage carousel slides from the public home snapshot", () => {
    currentHomeSnapshot = createHomeSnapshot({
      carouselSlides: [
        {
          id: "carousel-1",
          title: "CMS carousel title",
          subtitle: "CMS carousel subtitle",
          chip: "Homepage",
          imageUrl: "https://example.edu/carousel.jpg",
          imageAlt: "CMS carousel image",
          buttonLabel: "Read more",
          href: "/content/cms-carousel",
          enabled: true,
          order: 1,
          updatedAt: "2026-05-10T00:00:00.000Z"
        }
      ]
    });

    render(<PublicHomePage />);

    expect(screen.getByRole("img", { name: "CMS carousel image" })).toHaveAttribute(
      "src",
      "https://example.edu/carousel.jpg"
    );
    expect(screen.queryByText("CMS carousel title")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Read more" })).not.toBeInTheDocument();
  });

  it("defers below-the-fold homepage sections until they approach the viewport", async () => {
    const originalIntersectionObserver = window.IntersectionObserver;
    const observerCallbacks: IntersectionObserverCallback[] = [];

    class MockIntersectionObserver implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = "720px 0px";
      readonly thresholds = [0];

      constructor(callback: IntersectionObserverCallback) {
        observerCallbacks.push(callback);
      }

      disconnect = vi.fn();
      observe = vi.fn();
      takeRecords = vi.fn(() => []);
      unobserve = vi.fn();
    }

    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver
    });
    window.__RCAT_ENABLE_HOME_DEFER_TEST__ = true;

    currentHomeSnapshot = createHomeSnapshot({
      latestNews: [
        {
          id: "news-visible",
          title: "Visible top news",
          slug: "visible-top-news",
          type: "news",
          status: "published",
          owner: "Admin",
          summary: "Top news renders before deferred sections",
          updatedAt: "2026-05-03T00:00:00.000Z",
          publishAt: "2026-05-03T00:00:00.000Z"
        }
      ],
      programItems: [
        {
          id: "program-deferred",
          title: "Deferred program card",
          slug: "deferred-program-card",
          type: "program",
          status: "published",
          owner: "Admin",
          summary: "Program waits for the viewport gate",
          updatedAt: "2026-05-03T00:00:00.000Z",
          publishAt: "2026-05-03T00:00:00.000Z"
        }
      ]
    });

    try {
      render(<PublicHomePage />);

      expect(screen.getByText("Visible top news")).toBeInTheDocument();
      expect(screen.queryByText("Deferred program card")).not.toBeInTheDocument();
      expect(observerCallbacks.length).toBeGreaterThan(0);

      act(() => {
        observerCallbacks.forEach((callback) => {
          callback(
            [
              {
                isIntersecting: true,
                intersectionRatio: 1
              } as IntersectionObserverEntry
            ],
            {} as IntersectionObserver
          );
        });
      });

      expect(await screen.findByText("Deferred program card", undefined, { timeout: 5000 })).toBeInTheDocument();
    } finally {
      delete window.__RCAT_ENABLE_HOME_DEFER_TEST__;
      Object.defineProperty(window, "IntersectionObserver", {
        configurable: true,
        writable: true,
        value: originalIntersectionObserver
      });
    }
  });

  it("shows an honest empty state when no program content exists", async () => {
    currentHomeSnapshot = createHomeSnapshot();

    render(<PublicHomePage />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("ยังไม่มีข้อมูลหลักสูตรที่เผยแพร่")).toBeInTheDocument();
  });

  it("renders departments from the public program list snapshot", () => {
    currentProgramListSnapshot = createProgramListSnapshot({
      items: [
        {
          id: "program-1",
          title: "CMS program from list",
          slug: "cms-program",
          type: "program",
          status: "published",
          owner: "Admin",
          summary: "Program loaded without the full snapshot",
          updatedAt: "2026-05-03T00:00:00.000Z",
          publishAt: "2026-05-03T00:00:00.000Z"
        }
      ]
    });

    render(<PublicDepartmentsPage />);

    expect(screen.getByText("CMS program from list")).toBeInTheDocument();
    expect(screen.getByText("Program loaded without the full snapshot")).toBeInTheDocument();
  });

  it("renders the approved homepage information architecture", async () => {
    const baseSiteSettings = createSnapshot().siteSettings!;
    const latestNews: PublicHomeSnapshot["latestNews"] = [
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
      }
    ];
    const programItems: PublicHomeSnapshot["programItems"] = [
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
      }
    ];
    const latestAnnouncements: PublicHomeSnapshot["latestAnnouncements"] = [
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
      }
    ];
    const documentItems: PublicHomeSnapshot["documentItems"] = [
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
    ];
    const achievementItems: PublicHomeSnapshot["achievementItems"] = [
      {
        id: "achievement-1",
        title: "Regional innovation award",
        slug: "regional-innovation-award",
        type: "page",
        status: "published",
        owner: "Admin",
        summary: "A real CMS achievement highlight",
        category: "achievement",
        updatedAt: "2026-05-03T00:00:00.000Z",
        publishAt: "2026-05-03T00:00:00.000Z"
      }
    ];

    currentHomeSnapshot = createHomeSnapshot({
      latestNews,
      programItems,
      latestAnnouncements,
      documentItems,
      achievementItems,
      eventItems: [
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
      externalServices: [
        {
          id: "external-service-1",
          title: "Student portal",
          description: "Official service link",
          href: "https://services.example.edu/student",
          tone: "student",
          iconKey: "school",
          enabled: true,
          order: 1,
          updatedAt: "2026-05-10T00:00:00.000Z"
        }
      ],
      visitorStats: {
        enabled: true,
        usersToday: 1,
        usersYesterday: 2,
        usersThisMonth: 3,
        usersThisYear: 4,
        totalUsers: 5,
        totalViews: 6,
        onlineUsers: 7,
        updatedAt: "2026-05-10T00:00:00.000Z"
      },
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
    await screen.findByText("Website Visitors", undefined, { timeout: 5000 });
    await screen.findByText("ติดต่อและแผนที่", undefined, { timeout: 5000 });

    const pageText = document.body.textContent || "";
    const heroIndex = pageText.indexOf("ยินดีต้อนรับสู่วิทยาลัยตัวอย่าง");
    const directorIndex = pageText.indexOf("สารจากผู้อำนวยการ");
    const newsIndex = pageText.indexOf("ข่าวสารและกิจกรรมล่าสุด");
    const programsIndex = pageText.indexOf("หลักสูตรที่เปิดสอน");
    const announcementsIndex = pageText.indexOf("ประกาศล่าสุด");
    const eventsIndex = pageText.indexOf("กำหนดการ");
    const documentsIndex = pageText.indexOf("เอกสารเผยแพร่");
    const contactIndex = pageText.indexOf("ติดต่อและแผนที่");
    const procurementIndex = pageText.indexOf("ข่าวจัดซื้อจัดจ้าง");
    const achievementsIndex = pageText.indexOf("ผลงานและความภาคภูมิใจ");
    const externalServicesIndex = pageText.indexOf("บริการออนไลน์และลิงก์ที่เกี่ยวข้อง");
    const visitorStatsIndex = pageText.indexOf("Website Visitors");

    Object.entries({
      heroIndex,
      directorIndex,
      newsIndex,
      programsIndex,
      announcementsIndex,
      eventsIndex,
      documentsIndex,
      contactIndex,
      procurementIndex,
      achievementsIndex,
      externalServicesIndex,
      visitorStatsIndex
    }).forEach(([label, index]) => expect(index, label).toBeGreaterThanOrEqual(0));
    expect(heroIndex).toBeLessThan(directorIndex);
    expect(directorIndex).toBeLessThan(newsIndex);
    expect(newsIndex).toBeLessThan(procurementIndex);
    expect(procurementIndex).toBeLessThan(programsIndex);
    expect(programsIndex).toBeLessThan(achievementsIndex);
    expect(achievementsIndex).toBeLessThan(externalServicesIndex);
    expect(announcementsIndex).toBeLessThan(eventsIndex);
    expect(eventsIndex).toBeLessThan(documentsIndex);
    expect(documentsIndex).toBeLessThan(contactIndex);
    expect(contactIndex).toBeLessThan(visitorStatsIndex);

    expect(screen.getByText("ข่าวเปิดบ้านวิทยาลัย")).toBeInTheDocument();
    expect(screen.getByText("หลักสูตรช่างยนต์")).toBeInTheDocument();
    expect(screen.getByText("ประกาศรับสมัครนักเรียน")).toBeInTheDocument();
    expect(screen.getByText("ปฐมนิเทศนักศึกษาใหม่")).toBeInTheDocument();
    expect(screen.getByText("เอกสารแผนปฏิบัติการ")).toBeInTheDocument();
    expect(screen.getByText("ข่าวจัดซื้อจัดจ้าง")).toBeInTheDocument();
    expect(screen.getByText("ผลงานและความภาคภูมิใจ")).toBeInTheDocument();
    expect(screen.getByText("Regional innovation award")).toBeInTheDocument();
    expect(screen.getByText("Website Visitors")).toBeInTheDocument();
    expect(screen.getAllByText("บริการออนไลน์และลิงก์ที่เกี่ยวข้อง").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("กำหนดการ")).toHaveLength(1);
    expect(screen.getAllByText("ปฐมนิเทศนักศึกษาใหม่")).toHaveLength(1);

    const contactSection = screen.getByText("ติดต่อและแผนที่").closest("section") as HTMLElement;
    expect(contactSection).not.toBeNull();
    expect(contactSection).toHaveTextContent("วิทยาลัยเทคนิคตัวอย่าง");
    expect(within(contactSection).getByTitle("แผนที่วิทยาลัยเทคนิคตัวอย่าง")).toBeInTheDocument();
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
    currentContentListSnapshot = createContentListSnapshot({
      kind: "announcements",
      items: [
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
