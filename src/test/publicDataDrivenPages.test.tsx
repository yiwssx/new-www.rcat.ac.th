import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicSiteShell from "../public/components/PublicSiteShell";
import PublicAchievementsPage from "../public/pages/PublicAchievementsPage";
import PublicAnnouncementsPage from "../public/pages/PublicAnnouncementsPage";
import PublicCalendarPage from "../public/pages/PublicCalendarPage";
import PublicDepartmentsPage from "../public/pages/PublicDepartmentsPage";
import PublicDocumentsPage from "../public/pages/PublicDocumentsPage";
import PublicHomePage from "../public/pages/PublicHomePage";
import PublicNewsPage from "../public/pages/PublicNewsPage";
import PublicSearchPage from "../public/pages/PublicSearchPage";
import { projectSettings } from "../config/projectSettings";
import { defaultSiteSettings } from "../services/siteSettings";
import {
  CmsSnapshot,
  CalendarEvent,
  ContentItem,
  PublicContentListSnapshot,
  PublicDocumentListSnapshot,
  PublicDocumentItem,
  PublicEventListSnapshot,
  PublicHomeSnapshot,
  PublicProgramListSnapshot,
  PublicSearchIndexSnapshot
} from "../types";

const usePublicCmsSnapshotMock = vi.hoisted(() => vi.fn());
const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>
}));

let currentSnapshot: CmsSnapshot | undefined;
let currentHomeSnapshot: PublicHomeSnapshot | undefined;
let currentContentListSnapshot: PublicContentListSnapshot | undefined;
let currentProgramListSnapshot: PublicProgramListSnapshot | undefined;
let currentDocumentListSnapshot: PublicDocumentListSnapshot | undefined;
let currentEventListSnapshot: PublicEventListSnapshot | undefined;
let currentSearchIndexSnapshot: PublicSearchIndexSnapshot | undefined;
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
let currentDocumentListQueryState = {
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn()
};
let currentEventListQueryState = {
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn()
};
let currentSearchIndexQueryState = {
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

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => routerMocks.navigate,
  useRouterState: (options?: { select?: (state: { location: { search: Record<string, unknown> } }) => unknown }) => {
    const state = {
      location: {
        search: routerMocks.search
      }
    };

    return options?.select ? options.select(state) : state;
  }
}));

vi.mock("../public/hooks/usePublicHomeSnapshot", () => ({
  usePublicHomeSnapshot: () => ({
    data: currentHomeSnapshot,
    ...currentHomeQueryState
  })
}));

vi.mock("../public/hooks/useLiveVisitorStats", () => ({
  useLiveVisitorStats: (stats: unknown) => stats
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

vi.mock("../public/hooks/usePublicDocumentList", () => ({
  usePublicDocumentList: () => ({
    data: currentDocumentListSnapshot,
    ...currentDocumentListQueryState
  })
}));

vi.mock("../public/hooks/usePublicEventList", () => ({
  usePublicEventList: () => ({
    data: currentEventListSnapshot,
    ...currentEventListQueryState
  })
}));

vi.mock("../public/hooks/usePublicSearchIndex", () => ({
  usePublicSearchIndex: () => ({
    data: currentSearchIndexSnapshot,
    ...currentSearchIndexQueryState
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

function createContentItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "content-1",
    title: "Published content",
    slug: "published-content",
    type: "news",
    status: "published",
    owner: "Admin",
    summary: "Published content summary",
    category: "ทั่วไป",
    tags: [],
    updatedAt: "2026-05-03T00:00:00.000Z",
    publishAt: "2026-05-03T00:00:00.000Z",
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
        autoplayIntervalSeconds: 5,
        showArrows: true,
        showDots: true,
        pauseOnHover: true,
        pauseOnFocus: true,
        transition: "slide"
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

function createDocumentListSnapshot(overrides: Partial<PublicDocumentListSnapshot> = {}): PublicDocumentListSnapshot {
  return {
    items: [],
    generatedAt: "2026-05-12T00:00:00.000Z",
    ...overrides
  };
}

function createEventListSnapshot(overrides: Partial<PublicEventListSnapshot> = {}): PublicEventListSnapshot {
  return {
    items: [],
    media: [],
    generatedAt: "2026-05-12T00:00:00.000Z",
    ...overrides
  };
}

function createSearchIndexSnapshot(overrides: Partial<PublicSearchIndexSnapshot> = {}): PublicSearchIndexSnapshot {
  const snapshot = createSnapshot();

  return {
    items: [],
    siteSettings: snapshot.siteSettings!,
    homepageSettings: createHomeSnapshot().homepageSettings,
    displaySettings: snapshot.displaySettings,
    menu: snapshot.menu ?? [],
    generatedAt: "2026-05-12T00:00:00.000Z",
    ...overrides
  };
}

function createNumberedContentItems({
  count,
  prefix,
  titlePrefix,
  type = "news",
  category = "ทั่วไป",
  tags = [],
  summary = "Published content summary"
}: {
  count: number;
  prefix: string;
  titlePrefix: string;
  type?: ContentItem["type"];
  category?: string;
  tags?: string[];
  summary?: string;
}) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const day = String(number).padStart(2, "0");

    return createContentItem({
      id: `${prefix}-${number}`,
      title: `${titlePrefix} ${number}`,
      slug: `${prefix}-${number}`,
      type,
      category,
      tags,
      summary,
      publishAt: `2026-05-${day}T00:00:00.000Z`,
      updatedAt: `2026-05-${day}T00:00:00.000Z`
    });
  });
}

function createNumberedDocuments(count: number): PublicDocumentItem[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const day = String(number).padStart(2, "0");

    return {
      id: `document-${number}`,
      title: `เอกสารเผยแพร่ลำดับ ${number}`,
      description: "",
      category: number % 2 === 0 ? "คู่มือ" : "แผนงาน",
      fileUrl: `https://example.edu/document-${number}.pdf`,
      fileName: `document-${number}.pdf`,
      mediaId: "",
      publishedAt: `2026-05-${day}T00:00:00.000Z`,
      order: number,
      pinned: false,
      updatedAt: `2026-05-${day}T00:00:00.000Z`
    };
  });
}

function createNumberedEvents(count: number): CalendarEvent[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const day = String(number).padStart(2, "0");

    return {
      id: `event-${number}`,
      title: `กำหนดการลำดับ ${number}`,
      date: `2026-05-${day}T09:00:00.000Z`,
      audience: "public",
      status: "confirmed",
      visibility: "public"
    };
  });
}

beforeEach(() => {
  routerMocks.navigate.mockReset();
  routerMocks.search = {};
  currentSnapshot = createSnapshot();
  currentHomeSnapshot = createHomeSnapshot();
  currentContentListSnapshot = createContentListSnapshot();
  currentProgramListSnapshot = createProgramListSnapshot();
  currentDocumentListSnapshot = createDocumentListSnapshot();
  currentEventListSnapshot = createEventListSnapshot();
  currentSearchIndexSnapshot = createSearchIndexSnapshot();
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
  currentDocumentListQueryState = {
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn()
  };
  currentEventListQueryState = {
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn()
  };
  currentSearchIndexQueryState = {
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
  }, 10_000);

  it("limits homepage documents to three items and links to the full document page", async () => {
    currentHomeSnapshot = createHomeSnapshot({
      documentItems: [
        {
          id: "document-1",
          title: "เอกสารเผยแพร่ลำดับ 1",
          description: "",
          category: "แผนงาน",
          fileUrl: "https://example.edu/document-1.pdf",
          fileName: "document-1.pdf",
          mediaId: "",
          publishedAt: "2026-05-01T00:00:00.000Z",
          order: 1,
          pinned: true,
          updatedAt: "2026-05-04T00:00:00.000Z"
        },
        {
          id: "document-2",
          title: "เอกสารเผยแพร่ลำดับ 2",
          description: "",
          category: "แผนงาน",
          fileUrl: "https://example.edu/document-2.pdf",
          fileName: "document-2.pdf",
          mediaId: "",
          publishedAt: "2026-05-02T00:00:00.000Z",
          order: 2,
          pinned: false,
          updatedAt: "2026-05-04T00:00:00.000Z"
        },
        {
          id: "document-3",
          title: "เอกสารเผยแพร่ลำดับ 3",
          description: "",
          category: "แผนงาน",
          fileUrl: "https://example.edu/document-3.pdf",
          fileName: "document-3.pdf",
          mediaId: "",
          publishedAt: "2026-05-03T00:00:00.000Z",
          order: 3,
          pinned: false,
          updatedAt: "2026-05-04T00:00:00.000Z"
        },
        {
          id: "document-4",
          title: "เอกสารเผยแพร่ลำดับ 4",
          description: "",
          category: "แผนงาน",
          fileUrl: "https://example.edu/document-4.pdf",
          fileName: "document-4.pdf",
          mediaId: "",
          publishedAt: "2026-05-04T00:00:00.000Z",
          order: 4,
          pinned: false,
          updatedAt: "2026-05-04T00:00:00.000Z"
        }
      ]
    });

    render(<PublicHomePage />);
    expect(await screen.findByText("เอกสารเผยแพร่ลำดับ 1", undefined, { timeout: 5000 })).toBeInTheDocument();

    const documentsCard = screen.getByText("เอกสารเผยแพร่").closest(".rcat-card") as HTMLElement;
    expect(documentsCard).not.toBeNull();
    expect(within(documentsCard).getByText("เอกสารเผยแพร่ลำดับ 1")).toBeInTheDocument();
    expect(within(documentsCard).getByText("เอกสารเผยแพร่ลำดับ 2")).toBeInTheDocument();
    expect(within(documentsCard).getByText("เอกสารเผยแพร่ลำดับ 3")).toBeInTheDocument();
    expect(within(documentsCard).queryByText("เอกสารเผยแพร่ลำดับ 4")).not.toBeInTheDocument();
    expect(within(documentsCard).getByRole("link", { name: "ดูเอกสารเผยแพร่ทั้งหมด" })).toHaveAttribute(
      "href",
      "/documents"
    );
  }, 10_000);

  it("limits homepage schedule items to three events and links to the full calendar page", async () => {
    currentHomeSnapshot = createHomeSnapshot({
      eventItems: [
        {
          id: "event-1",
          title: "กำหนดการลำดับ 1",
          date: "2026-05-01T09:00:00.000Z",
          audience: "public",
          status: "confirmed",
          visibility: "public"
        },
        {
          id: "event-2",
          title: "กำหนดการลำดับ 2",
          date: "2026-05-02T09:00:00.000Z",
          audience: "public",
          status: "confirmed",
          visibility: "public"
        },
        {
          id: "event-3",
          title: "กำหนดการลำดับ 3",
          date: "2026-05-03T09:00:00.000Z",
          audience: "public",
          status: "confirmed",
          visibility: "public"
        },
        {
          id: "event-4",
          title: "กำหนดการลำดับ 4",
          date: "2026-05-04T09:00:00.000Z",
          audience: "public",
          status: "confirmed",
          visibility: "public"
        }
      ]
    });

    render(<PublicHomePage />);
    expect(await screen.findByText("กำหนดการลำดับ 1", undefined, { timeout: 5000 })).toBeInTheDocument();

    const calendarCard = screen.getByText("กำหนดการ").closest(".MuiCard-root") as HTMLElement;
    expect(calendarCard).not.toBeNull();
    expect(within(calendarCard).getByText("กำหนดการลำดับ 1")).toBeInTheDocument();
    expect(within(calendarCard).getByText("กำหนดการลำดับ 2")).toBeInTheDocument();
    expect(within(calendarCard).getByText("กำหนดการลำดับ 3")).toBeInTheDocument();
    expect(within(calendarCard).queryByText("กำหนดการลำดับ 4")).not.toBeInTheDocument();
    expect(within(calendarCard).getByRole("link", { name: "ดูกำหนดการทั้งหมด" })).toHaveAttribute("href", "/calendar");
  }, 10_000);

  it("limits homepage achievements to the latest six items and links to the archive", async () => {
    currentHomeSnapshot = createHomeSnapshot({
      achievementItems: createNumberedContentItems({
        count: 8,
        prefix: "achievement",
        titlePrefix: "ผลงานลำดับ",
        type: "page",
        category: "ผลงาน"
      })
    });

    render(<PublicHomePage />);

    expect(await screen.findByText("ผลงานลำดับ 8", undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText("ผลงานลำดับ 3")).toBeInTheDocument();
    expect(screen.queryByText("ผลงานลำดับ 2")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /อ่านผลงาน/ })).toHaveLength(6);
    expect(screen.getByRole("link", { name: "ดูผลงานทั้งหมด" })).toHaveAttribute("href", "/achievements");
  }, 10_000);

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
          imageFit: "fit-blur",
          focalPointX: 50,
          focalPointY: 50,
          mobileImageUrl: "",
          backgroundColor: "",
          openInNewTab: false,
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

  it("renders one shared marquee on the homepage", () => {
    currentHomeSnapshot = createHomeSnapshot({
      homepageSettings: {
        ...createHomeSnapshot().homepageSettings,
        marquee: {
          enabled: true,
          label: "ประกาศ",
          text: "ประกาศสำหรับทุกหน้า",
          speedSeconds: 60
        }
      }
    });

    render(<PublicHomePage />);

    expect(screen.getAllByRole("region", { name: "ประกาศด่วน" })).toHaveLength(1);
  });

  it("renders shared marquee and public-only mourning mode from shell settings", () => {
    currentSnapshot = createSnapshot({
      siteSettings: {
        ...createSnapshot().siteSettings!,
        mourningModeEnabled: true,
        mourningModeLabel: "โหมดไว้อาลัย",
        mourningModeNotice: "ร่วมแสดงความอาลัย"
      },
      homepageSettings: {
        ...createHomeSnapshot().homepageSettings,
        marquee: {
          enabled: true,
          label: "ประกาศ",
          text: "ประกาศสำหรับทุกหน้า",
          speedSeconds: 60
        }
      }
    });

    const { container } = render(
      <PublicSiteShell>
        <div>Public content</div>
      </PublicSiteShell>
    );

    expect(screen.getByRole("region", { name: "ประกาศด่วน" })).toBeInTheDocument();
    expect(screen.getByText("ร่วมแสดงความอาลัย")).toBeInTheDocument();
    expect(container.querySelector(".rcat-mourning-mode")).toHaveAttribute("data-mourning-mode", "true");
  });

  it("removes mourning mode immediately when the latest shell settings disable it", () => {
    currentSnapshot = createSnapshot({
      siteSettings: {
        ...createSnapshot().siteSettings!,
        mourningModeEnabled: true,
        mourningModeNotice: "ร่วมแสดงความอาลัย"
      }
    });

    const { container, rerender } = render(
      <PublicSiteShell>
        <div>Public content</div>
      </PublicSiteShell>
    );

    expect(container.querySelector(".rcat-page")).toHaveClass("rcat-mourning-mode");
    expect(container.querySelector(".rcat-page")).toHaveAttribute("data-mourning-mode", "true");

    currentSnapshot = createSnapshot({
      siteSettings: {
        ...createSnapshot().siteSettings!,
        mourningModeEnabled: false,
        mourningModeNotice: ""
      }
    });

    rerender(
      <PublicSiteShell>
        <div>Public content</div>
      </PublicSiteShell>
    );

    expect(container.querySelector(".rcat-page")).not.toHaveClass("rcat-mourning-mode");
    expect(container.querySelector(".rcat-page")).toHaveAttribute("data-mourning-mode", "false");
    expect(document.body).not.toHaveClass("rcat-mourning-mode");
    expect(document.documentElement).not.toHaveClass("rcat-mourning-mode");
    expect(screen.queryByText("ร่วมแสดงความอาลัย")).not.toBeInTheDocument();
  });

  it("renders the shared marquee on non-home public pages when enabled", () => {
    currentContentListSnapshot = createContentListSnapshot({
      homepageSettings: {
        ...createHomeSnapshot().homepageSettings,
        marquee: {
          enabled: true,
          label: "ประกาศ",
          text: "ประกาศสำหรับทุกหน้า",
          speedSeconds: 60
        }
      }
    });

    render(<PublicAnnouncementsPage />);

    expect(screen.getAllByRole("region", { name: "ประกาศด่วน" })).toHaveLength(1);
    expect(screen.getByText("ประกาศสำหรับทุกหน้า")).toBeInTheDocument();
    expect(document.querySelector(".rcat-marquee-track")).toBeInTheDocument();
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

  it("renders visitor stats in the initial homepage DOM without waiting for the defer observer", () => {
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
      visitorStats: {
        enabled: true,
        usersToday: 0,
        usersYesterday: 0,
        usersThisMonth: 0,
        usersThisYear: 0,
        totalUsers: 0,
        totalViews: 12,
        onlineUsers: 0,
        updatedAt: "2026-05-10T00:00:00.000Z"
      },
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

      const visitorStatsRegion = screen.getByRole("region", { name: "Website Visitors" });
      const onlineLabel = within(visitorStatsRegion).getByText("Who's Online");

      expect(document.body).toHaveTextContent("Who's Online");
      expect(onlineLabel.parentElement).toHaveTextContent("0");
      expect(within(visitorStatsRegion).getByText("Total views")).toBeInTheDocument();
      expect(within(visitorStatsRegion).getByText("12")).toBeInTheDocument();
      expect(screen.queryByText("Deferred program card")).not.toBeInTheDocument();
      expect(observerCallbacks.length).toBeGreaterThan(0);
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

  it("paginates public departments at twelve items", () => {
    currentProgramListSnapshot = createProgramListSnapshot({
      items: createNumberedContentItems({
        count: 13,
        prefix: "program",
        titlePrefix: "หลักสูตรลำดับ",
        type: "program"
      })
    });

    render(<PublicDepartmentsPage />);

    expect(screen.getByText("หลักสูตรลำดับ 12")).toBeInTheDocument();
    expect(screen.queryByText("หลักสูตรลำดับ 13")).not.toBeInTheDocument();
    expect(screen.getByText("แสดง 1–12 จากทั้งหมด 13 รายการ")).toBeInTheDocument();
  });

  it("renders the public achievements archive and paginates at twelve items", () => {
    currentSearchIndexSnapshot = createSearchIndexSnapshot({
      items: [
        ...createNumberedContentItems({
          count: 13,
          prefix: "achievement-archive",
          titlePrefix: "ผลงานเกียรติยศ",
          type: "page",
          category: "รางวัล",
          summary: "award achievement"
        }),
        createContentItem({
          id: "regular-news",
          title: "ข่าวทั่วไป",
          slug: "regular-news",
          category: "ข่าว",
          summary: "general news"
        })
      ]
    });

    render(<PublicAchievementsPage />);

    expect(screen.getByText("ผลงานและความภาคภูมิใจ")).toBeInTheDocument();
    expect(screen.getByText("ผลงานเกียรติยศ 13")).toBeInTheDocument();
    expect(screen.getByText("ผลงานเกียรติยศ 2")).toBeInTheDocument();
    expect(screen.queryByText("ผลงานเกียรติยศ 1")).not.toBeInTheDocument();
    expect(screen.queryByText("ข่าวทั่วไป")).not.toBeInTheDocument();
    expect(screen.getByText("แสดง 1–12 จากทั้งหมด 13 รายการ")).toBeInTheDocument();
  });

  it("uses the page query parameter on the achievements archive", () => {
    window.history.pushState({}, "", "/achievements?page=2");
    currentSearchIndexSnapshot = createSearchIndexSnapshot({
      items: createNumberedContentItems({
        count: 13,
        prefix: "achievement-query",
        titlePrefix: "ผลงานหน้าที่",
        type: "page",
        category: "ผลงาน"
      })
    });

    render(<PublicAchievementsPage />);

    expect(screen.getByText("ผลงานหน้าที่ 1")).toBeInTheDocument();
    expect(screen.queryByText("ผลงานหน้าที่ 13")).not.toBeInTheDocument();
    expect(screen.getByText("แสดง 13–13 จากทั้งหมด 13 รายการ")).toBeInTheDocument();
  });

  it("paginates the news list without duplicating the featured item or rendering all cards", () => {
    currentContentListSnapshot = createContentListSnapshot({
      kind: "news",
      items: createNumberedContentItems({
        count: 14,
        prefix: "news",
        titlePrefix: "ข่าวลำดับ",
        type: "news"
      })
    });

    render(<PublicNewsPage />);

    expect(screen.getByText("ข่าวลำดับ 1")).toBeInTheDocument();
    expect(screen.getByText("ข่าวลำดับ 13")).toBeInTheDocument();
    expect(screen.queryByText("ข่าวลำดับ 14")).not.toBeInTheDocument();
    expect(screen.getByText("แสดง 1–12 จากทั้งหมด 13 รายการ")).toBeInTheDocument();
  });

  it("paginates public search results at twelve items", () => {
    routerMocks.search = { q: "award" };
    window.history.pushState({}, "", "/search?q=award");
    currentSearchIndexSnapshot = createSearchIndexSnapshot({
      items: createNumberedContentItems({
        count: 13,
        prefix: "search-award",
        titlePrefix: "Award result",
        type: "news",
        category: "award",
        summary: "award result"
      })
    });

    render(<PublicSearchPage />);

    expect(screen.getByText('พบ 13 รายการสำหรับ "award"')).toBeInTheDocument();
    expect(screen.getByText("Award result 13")).toBeInTheDocument();
    expect(screen.getByText("Award result 2")).toBeInTheDocument();
    expect(screen.queryByText("Award result 1")).not.toBeInTheDocument();
    expect(screen.getByText("แสดง 1–12 จากทั้งหมด 13 รายการ")).toBeInTheDocument();
  });

  it("paginates the public announcement list", () => {
    currentContentListSnapshot = createContentListSnapshot({
      kind: "announcements",
      items: createNumberedContentItems({
        count: 13,
        prefix: "announcement",
        titlePrefix: "ประกาศลำดับ",
        type: "announcement"
      }),
      pageItems: []
    });

    render(<PublicAnnouncementsPage />);

    expect(screen.getByText("ประกาศลำดับ 12")).toBeInTheDocument();
    expect(screen.queryByText("ประกาศลำดับ 13")).not.toBeInTheDocument();
    expect(screen.getByText("แสดง 1–12 จากทั้งหมด 13 รายการ")).toBeInTheDocument();
  });

  it("renders all published documents on the public document archive page", () => {
    currentDocumentListSnapshot = createDocumentListSnapshot({
      items: [
        {
          id: "document-pinned",
          title: "เอกสารปักหมุด",
          description: "ประกาศสำคัญ",
          category: "ประกาศ",
          fileUrl: "https://example.edu/pinned.pdf",
          fileName: "pinned.pdf",
          mediaId: "",
          publishedAt: "2026-05-01T00:00:00.000Z",
          order: 1,
          pinned: true,
          updatedAt: "2026-05-04T00:00:00.000Z"
        },
        {
          id: "document-general-1",
          title: "เอกสารทั่วไปลำดับ 1",
          description: "คู่มือสำหรับนักเรียน",
          category: "คู่มือ",
          fileUrl: "https://example.edu/general-1.pdf",
          fileName: "general-1.pdf",
          mediaId: "",
          publishedAt: "2026-05-02T00:00:00.000Z",
          order: 2,
          pinned: false,
          updatedAt: "2026-05-04T00:00:00.000Z"
        },
        {
          id: "document-general-2",
          title: "เอกสารทั่วไปลำดับ 2",
          description: "แบบฟอร์ม",
          category: "แบบฟอร์ม",
          fileUrl: "https://example.edu/general-2.pdf",
          fileName: "general-2.pdf",
          mediaId: "",
          publishedAt: "2026-05-03T00:00:00.000Z",
          order: 3,
          pinned: false,
          updatedAt: "2026-05-04T00:00:00.000Z"
        },
        {
          id: "document-general-3",
          title: "เอกสารทั่วไปลำดับ 3",
          description: "แผนงาน",
          category: "แผนงาน",
          fileUrl: "https://example.edu/general-3.pdf",
          fileName: "general-3.pdf",
          mediaId: "",
          publishedAt: "2026-05-04T00:00:00.000Z",
          order: 4,
          pinned: false,
          updatedAt: "2026-05-04T00:00:00.000Z"
        }
      ]
    });

    render(<PublicDocumentsPage />);

    const documentLinks = screen.getAllByRole("link", { name: /อ่านเอกสาร/ });
    expect(documentLinks.map((link) => link.textContent)).toEqual([
      expect.stringContaining("เอกสารปักหมุด"),
      expect.stringContaining("เอกสารทั่วไปลำดับ 1"),
      expect.stringContaining("เอกสารทั่วไปลำดับ 2"),
      expect.stringContaining("เอกสารทั่วไปลำดับ 3")
    ]);
  });

  it("filters the public document archive by search text", async () => {
    const user = userEvent.setup();
    currentDocumentListSnapshot = createDocumentListSnapshot({
      items: [
        {
          id: "document-plan",
          title: "แผนปฏิบัติการประจำปี",
          description: "",
          category: "แผนงาน",
          fileUrl: "https://example.edu/plan.pdf",
          fileName: "plan.pdf",
          mediaId: "",
          publishedAt: "2026-05-01T00:00:00.000Z",
          order: 1,
          pinned: false,
          updatedAt: "2026-05-04T00:00:00.000Z"
        },
        {
          id: "document-form",
          title: "แบบฟอร์มนักเรียน",
          description: "",
          category: "แบบฟอร์ม",
          fileUrl: "https://example.edu/student-form.pdf",
          fileName: "student-form.pdf",
          mediaId: "",
          publishedAt: "2026-05-02T00:00:00.000Z",
          order: 2,
          pinned: false,
          updatedAt: "2026-05-04T00:00:00.000Z"
        }
      ]
    });

    render(<PublicDocumentsPage />);
    expect(screen.getByRole("combobox", { name: /กรองหมวดหมู่เอกสาร/ })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "ค้นหาเอกสารเผยแพร่" }), "student-form");

    expect(screen.queryByText("แผนปฏิบัติการประจำปี")).not.toBeInTheDocument();
    expect(screen.getByText("แบบฟอร์มนักเรียน")).toBeInTheDocument();
  });

  it("uses the page query parameter on the public document archive", () => {
    window.history.pushState({}, "", "/documents?page=2");
    currentDocumentListSnapshot = createDocumentListSnapshot({
      items: createNumberedDocuments(16)
    });

    render(<PublicDocumentsPage />);

    expect(screen.getByText("เอกสารเผยแพร่ลำดับ 16")).toBeInTheDocument();
    expect(screen.queryByText("เอกสารเผยแพร่ลำดับ 1")).not.toBeInTheDocument();
    expect(screen.getByText("แสดง 16–16 จากทั้งหมด 16 รายการ")).toBeInTheDocument();
  });

  it("clamps invalid document page queries safely", () => {
    window.history.pushState({}, "", "/documents?page=invalid");
    currentDocumentListSnapshot = createDocumentListSnapshot({
      items: createNumberedDocuments(16)
    });

    render(<PublicDocumentsPage />);

    expect(screen.getByText("เอกสารเผยแพร่ลำดับ 1")).toBeInTheDocument();
    expect(screen.queryByText("เอกสารเผยแพร่ลำดับ 16")).not.toBeInTheDocument();
    expect(screen.getByText("แสดง 1–15 จากทั้งหมด 16 รายการ")).toBeInTheDocument();
  });

  it("shows public document archive empty and error states", () => {
    currentDocumentListSnapshot = createDocumentListSnapshot({ items: [] });
    const { rerender } = render(<PublicDocumentsPage />);

    expect(screen.getByText("ยังไม่มีเอกสารเผยแพร่")).toBeInTheDocument();

    currentDocumentListSnapshot = undefined;
    currentDocumentListQueryState = {
      ...currentDocumentListQueryState,
      isError: true
    };
    rerender(<PublicDocumentsPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("ไม่สามารถโหลดข้อมูลได้");
    expect(screen.getByRole("button", { name: "ลองอีกครั้ง" })).toBeInTheDocument();
  });

  it("paginates public confirmed calendar events in descending date order", () => {
    currentEventListSnapshot = createEventListSnapshot({
      items: createNumberedEvents(13)
    });

    render(<PublicCalendarPage />);

    expect(screen.getByText("กำหนดการลำดับ 13")).toBeInTheDocument();

    expect(screen.getByText("กำหนดการลำดับ 2")).toBeInTheDocument();

    expect(screen.queryByText("กำหนดการลำดับ 1")).not.toBeInTheDocument();

    expect(screen.getByText("แสดง 1–12 จากทั้งหมด 13 รายการ")).toBeInTheDocument();
  });

  it("shows lifecycle statuses, date ranges, and event media without exposing internal fields", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-07-15T12:00:00+07:00"));

    try {
      const user = userEvent.setup();

      currentEventListSnapshot = createEventListSnapshot({
        items: [
          {
            id: "event-ended",
            title: "กิจกรรมสิ้นสุดแล้ว",
            date: "2026-07-14T09:00:00+07:00",
            endDate: "2026-07-14T10:00:00+07:00",
            audience: "นักเรียน",
            status: "confirmed",
            visibility: "public"
          },
          {
            id: "event-ongoing",
            title: "กิจกรรมกำลังดำเนิน",
            date: "2026-07-15T11:00:00+07:00",
            endDate: "2026-07-15T13:00:00+07:00",
            audience: "นักเรียนและครู",
            status: "confirmed",
            visibility: "public",
            location: "หอประชุม",
            description: "รายละเอียดกิจกรรมที่กำลังดำเนิน",
            mediaIds: ["event-image"]
          },
          {
            id: "event-upcoming",
            title: "กิจกรรมกำลังจะมาถึง",
            date: "2026-07-16T09:00:00+07:00",
            endDate: "2026-07-16T10:00:00+07:00",
            audience: "ผู้ปกครอง",
            status: "confirmed",
            visibility: "public"
          }
        ],
        media: [
          {
            id: "event-image",
            name: "ภาพกิจกรรม",
            type: "image",
            size: "120 KB",
            owner: "Admin",
            driveUrl: "https://files.example.test/event-image.jpg",
            previewUrl: "https://files.example.test/event-image.jpg",
            updatedAt: "2026-07-15T00:00:00.000Z"
          }
        ]
      });

      render(<PublicCalendarPage />);

      const calendarHeading = screen.getByRole("heading", {
        name: "กำหนดการ",
        level: 2
      });

      const calendarCard = calendarHeading.closest<HTMLElement>(".MuiCard-root");

      expect(calendarCard).not.toBeNull();

      if (!calendarCard) {
        throw new Error("Calendar card was not found");
      }

      const calendarCardQueries = within(calendarCard);

      const detailButtons = calendarCardQueries.getAllByRole("button", {
        name: /^ดูรายละเอียด /
      });

      expect(detailButtons.map((button) => button.getAttribute("aria-label"))).toEqual([
        "ดูรายละเอียด กิจกรรมกำลังจะมาถึง",
        "ดูรายละเอียด กิจกรรมกำลังดำเนิน",
        "ดูรายละเอียด กิจกรรมสิ้นสุดแล้ว"
      ]);

      expect(calendarCardQueries.getByText("กำลังจะมาถึง")).toBeInTheDocument();

      expect(calendarCardQueries.getByText("กำลังดำเนิน")).toBeInTheDocument();

      expect(calendarCardQueries.getByText("สิ้นสุดแล้ว")).toBeInTheDocument();

      expect(calendarCardQueries.queryByText(/^confirmed$/i)).not.toBeInTheDocument();

      expect(calendarCardQueries.queryByText(/^public$/i)).not.toBeInTheDocument();

      await user.click(
        screen.getByRole("button", {
          name: "ดูรายละเอียด กิจกรรมกำลังดำเนิน"
        })
      );

      const dialog = await screen.findByRole("dialog", {
        name: "กิจกรรมกำลังดำเนิน"
      });

      expect(dialog).toHaveTextContent("วันเวลาเริ่มต้น - วันเวลาสิ้นสุด");

      expect(dialog).toHaveTextContent("11:00");

      expect(dialog).toHaveTextContent("13:00");

      expect(within(dialog).getByText("กำลังดำเนิน")).toBeInTheDocument();

      expect(within(dialog).queryByText(/^confirmed$/i)).not.toBeInTheDocument();

      expect(within(dialog).queryByText(/^public$/i)).not.toBeInTheDocument();

      expect(within(dialog).queryByText("การมองเห็น")).not.toBeInTheDocument();

      expect(
        within(dialog).getByRole("img", {
          name: "ภาพกิจกรรม"
        })
      ).toHaveAttribute("src", "https://files.example.test/event-image.jpg");
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("renders all public confirmed events on the public calendar page and keeps detail dialogs", async () => {
    const user = userEvent.setup();
    currentEventListSnapshot = createEventListSnapshot({
      items: [
        {
          id: "event-public-1",
          title: "เปิดภาคเรียน",
          date: "2026-05-01T09:00:00.000Z",
          audience: "นักเรียน",
          status: "confirmed",
          location: "วิทยาลัย",
          description: "รายละเอียดเปิดภาคเรียน",
          visibility: "public"
        },
        {
          id: "event-public-2",
          title: "ประชุมผู้ปกครอง",
          date: "2026-05-02T09:00:00.000Z",
          audience: "ผู้ปกครอง",
          status: "confirmed",
          visibility: "public"
        },
        {
          id: "event-public-3",
          title: "กิจกรรมอาชีวะ",
          date: "2026-05-03T09:00:00.000Z",
          audience: "public",
          status: "confirmed",
          visibility: "public"
        },
        {
          id: "event-public-4",
          title: "วันแนะแนว",
          date: "2026-05-04T09:00:00.000Z",
          audience: "public",
          status: "confirmed",
          visibility: "public"
        },
        {
          id: "event-draft",
          title: "กำหนดการฉบับร่าง",
          date: "2026-05-05T09:00:00.000Z",
          audience: "internal",
          status: "draft",
          visibility: "public"
        },
        {
          id: "event-private",
          title: "ประชุมภายใน",
          date: "2026-05-06T09:00:00.000Z",
          audience: "staff",
          status: "confirmed",
          visibility: "private"
        },
        {
          id: "event-cancelled",
          title: "กิจกรรมยกเลิก",
          date: "2026-05-07T09:00:00.000Z",
          audience: "public",
          status: "cancelled",
          visibility: "public"
        }
      ]
    });

    render(<PublicCalendarPage />);

    expect(screen.getByText("เปิดภาคเรียน")).toBeInTheDocument();
    expect(screen.getByText("ประชุมผู้ปกครอง")).toBeInTheDocument();
    expect(screen.getByText("กิจกรรมอาชีวะ")).toBeInTheDocument();
    expect(screen.getByText("วันแนะแนว")).toBeInTheDocument();
    expect(screen.queryByText("กำหนดการฉบับร่าง")).not.toBeInTheDocument();
    expect(screen.queryByText("ประชุมภายใน")).not.toBeInTheDocument();
    expect(screen.queryByText("กิจกรรมยกเลิก")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ดูรายละเอียด เปิดภาคเรียน" }));
    expect(screen.getByRole("dialog", { name: "เปิดภาคเรียน" })).toHaveTextContent("รายละเอียดเปิดภาคเรียน");
  });

  it("shows public calendar empty and error states", () => {
    currentEventListSnapshot = createEventListSnapshot({ items: [] });
    const { rerender } = render(<PublicCalendarPage />);

    expect(screen.getByText("ยังไม่มีกำหนดการเผยแพร่")).toBeInTheDocument();

    currentEventListSnapshot = undefined;
    currentEventListQueryState = {
      ...currentEventListQueryState,
      isError: true
    };
    rerender(<PublicCalendarPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("ไม่สามารถโหลดข้อมูลได้");
    expect(screen.getByRole("button", { name: "ลองอีกครั้ง" })).toBeInTheDocument();
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
    await Promise.all([
      screen.findByText("Website Visitors", undefined, { timeout: 10000 }),
      screen.findByText("ติดต่อและแผนที่", undefined, { timeout: 10000 }),
      screen.findByText("ผลงานและความภาคภูมิใจ", undefined, { timeout: 10000 }),
      screen.findAllByText("บริการออนไลน์และลิงก์ที่เกี่ยวข้อง", undefined, { timeout: 10000 })
    ]);

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
  }, 15000);

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
