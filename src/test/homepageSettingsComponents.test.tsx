import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FloatingMessengerButton from "../public/components/FloatingMessengerButton";
import PublicHomeCarousel from "../public/components/PublicHomeCarousel";
import PublicIntroGate from "../public/components/PublicIntroGate";
import { AchievementHighlightsSection } from "../public/components/home/AchievementHighlightsSection";
import { ContactMapCard } from "../public/components/home/ContactMapCard";
import { DirectorHeroCard } from "../public/components/home/DirectorHeroCard";
import { ExternalServicesSection } from "../public/components/home/ExternalServicesSection";
import { HomeIntroVideoSection } from "../public/components/home/HomeIntroVideoSection";
import { UrgentMarqueeSection } from "../public/components/home/UrgentMarqueeSection";
import {
  defaultMarqueePixelsPerSecond,
  getMarqueeMotion,
  getMarqueePixelsPerSecond
} from "../public/components/home/urgentMarqueeMotion";
import { VisitorStatsCard } from "../public/components/home/VisitorStatsCard";
import { shouldStartCarouselAutoplay } from "../public/utils/homeCarousel";
import { DEFAULT_HOMEPAGE_SETTINGS } from "../services/homepageSettings";
import { defaultSiteSettings } from "../services/siteSettings";
import { CarouselSlide, ContentItem, ExternalServiceLink, HomepageIntroGateSettings } from "../types";

function createIntroGateSettings(overrides: Partial<HomepageIntroGateSettings> = {}): HomepageIntroGateSettings {
  return {
    ...DEFAULT_HOMEPAGE_SETTINGS.introGate,
    enabled: true,
    imageUrl: "https://example.edu/intro.jpg",
    imageAlt: "Intro image",
    primaryButtonLabel: "เข้าสู่เว็บไซต์หลัก",
    storageKey: "intro-test",
    ...overrides
  };
}

function mockMarqueeMeasurements({ viewportWidth, trackWidth }: { viewportWidth: number; trackWidth: number }) {
  const boundingRectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    const element = this as HTMLElement;
    const width = element.classList.contains("rcat-marquee-viewport")
      ? viewportWidth
      : element.classList.contains("rcat-marquee-track")
        ? trackWidth
        : 0;

    return {
      x: 0,
      y: 0,
      width,
      height: 24,
      top: 0,
      right: width,
      bottom: 24,
      left: 0,
      toJSON: () => ({})
    } as DOMRect;
  });
  const scrollWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");

  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get() {
      return (this as HTMLElement).classList.contains("rcat-marquee-track") ? trackWidth : 0;
    }
  });

  return () => {
    boundingRectSpy.mockRestore();

    if (scrollWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "scrollWidth", scrollWidthDescriptor);
      return;
    }

    delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
  };
}

function expectMotionSpeed(
  motion: ReturnType<typeof getMarqueeMotion>,
  totalDistancePx: number,
  expectedPixelsPerSecond: number
) {
  expect(totalDistancePx / motion.durationSeconds).toBeCloseTo(expectedPixelsPerSecond, 5);
}

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("homepage settings public sections", () => {
  it("does not render IntroGate when disabled or imageUrl is empty", () => {
    expect(render(<PublicIntroGate settings={DEFAULT_HOMEPAGE_SETTINGS.introGate} />).container.firstChild).toBeNull();

    expect(
      render(
        <PublicIntroGate
          settings={{
            ...DEFAULT_HOMEPAGE_SETTINGS.introGate,
            enabled: true
          }}
        />
      ).container.firstChild
    ).toBeNull();
  });

  it("shows IntroGate when settings become enabled after the first render", () => {
    const { rerender } = render(<PublicIntroGate settings={DEFAULT_HOMEPAGE_SETTINGS.introGate} />);

    expect(screen.queryByRole("dialog", { name: "หน้าแนะนำก่อนเข้าสู่เว็บไซต์" })).not.toBeInTheDocument();

    rerender(<PublicIntroGate settings={createIntroGateSettings()} />);

    expect(screen.getByRole("dialog", { name: "หน้าแนะนำก่อนเข้าสู่เว็บไซต์" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Intro image" })).toHaveAttribute("src", "https://example.edu/intro.jpg");
  });

  it("does not show IntroGate when sessionStorage has a dismissed marker", () => {
    window.sessionStorage.setItem("intro-test", "dismissed");

    render(<PublicIntroGate settings={createIntroGateSettings()} />);

    expect(screen.queryByRole("dialog", { name: "หน้าแนะนำก่อนเข้าสู่เว็บไซต์" })).not.toBeInTheDocument();
  });

  it("stores a dismissed marker and hides IntroGate after entering the site", () => {
    render(<PublicIntroGate settings={createIntroGateSettings()} />);

    fireEvent.click(screen.getByRole("button", { name: /เข้าสู่เว็บไซต์หลัก/ }));

    expect(window.sessionStorage.getItem("intro-test")).toBe("dismissed");
    expect(screen.queryByRole("dialog", { name: "หน้าแนะนำก่อนเข้าสู่เว็บไซต์" })).not.toBeInTheDocument();
  });

  it("renders DirectorHeroCard with a normalized Google Drive image URL", () => {
    render(
      <DirectorHeroCard
        siteSettings={{
          ...defaultSiteSettings,
          directorTitle: "Director",
          directorName: "Director Example",
          directorImageUrl: "https://drive.google.com/file/d/RCAT_director-2026_ABC123/view?usp=sharing"
        }}
      />
    );

    expect(screen.getByRole("img", { name: /Director Example/ })).toHaveAttribute(
      "src",
      "https://drive.google.com/thumbnail?id=RCAT_director-2026_ABC123&sz=w1600"
    );
    expect(screen.getByRole("img", { name: /Director Example/ })).toHaveAttribute(
      "srcset",
      [
        "https://drive.google.com/thumbnail?id=RCAT_director-2026_ABC123&sz=w640 640w",
        "https://drive.google.com/thumbnail?id=RCAT_director-2026_ABC123&sz=w900 900w",
        "https://drive.google.com/thumbnail?id=RCAT_director-2026_ABC123&sz=w1200 1200w",
        "https://drive.google.com/thumbnail?id=RCAT_director-2026_ABC123&sz=w1600 1600w"
      ].join(", ")
    );
  });

  it("renders DirectorHeroCard placeholder when the configured image URL is invalid", () => {
    render(
      <DirectorHeroCard
        siteSettings={{
          ...defaultSiteSettings,
          directorTitle: "Director",
          directorName: "Director Example",
          directorImageUrl: "javascript:alert(1)"
        }}
      />
    );

    expect(screen.queryByRole("img", { name: /Director Example/ })).not.toBeInTheDocument();
    expect(screen.getByText("Director Example")).toBeInTheDocument();
  });

  it("re-evaluates IntroGate visibility when storageKey changes", () => {
    window.sessionStorage.setItem("intro-dismissed", "dismissed");
    const { rerender } = render(
      <PublicIntroGate settings={createIntroGateSettings({ storageKey: "intro-dismissed" })} />
    );

    expect(screen.queryByRole("dialog", { name: "หน้าแนะนำก่อนเข้าสู่เว็บไซต์" })).not.toBeInTheDocument();

    rerender(<PublicIntroGate settings={createIntroGateSettings({ storageKey: "intro-new" })} />);

    expect(screen.getByRole("dialog", { name: "หน้าแนะนำก่อนเข้าสู่เว็บไซต์" })).toBeInTheDocument();
  });

  it("does not render UrgentMarqueeSection when disabled or text is empty", () => {
    expect(
      render(<UrgentMarqueeSection settings={DEFAULT_HOMEPAGE_SETTINGS.marquee} />).container.firstChild
    ).toBeNull();

    expect(
      render(
        <UrgentMarqueeSection
          settings={{
            ...DEFAULT_HOMEPAGE_SETTINGS.marquee,
            enabled: true
          }}
        />
      ).container.firstChild
    ).toBeNull();
  });

  it("maps stored marquee speedSeconds to bounded pixels per second", () => {
    expect(getMarqueePixelsPerSecond(60)).toBe(defaultMarqueePixelsPerSecond);
    expect(getMarqueePixelsPerSecond(24)).toBe(180);
    expect(getMarqueePixelsPerSecond(180)).toBe(35);
    expect(getMarqueePixelsPerSecond(Number.NaN)).toBe(defaultMarqueePixelsPerSecond);
  });

  it("calculates different desktop and mobile durations with the same pixels-per-second ratio", () => {
    const mobile = getMarqueeMotion(320, 680, 80);
    const desktop = getMarqueeMotion(1440, 680, 80);

    expect(mobile.durationSeconds).not.toBe(desktop.durationSeconds);
    expectMotionSpeed(mobile, 1000, 80);
    expectMotionSpeed(desktop, 2120, 80);
  });

  it("increases marquee duration when measured distance increases", () => {
    const shortDistance = getMarqueeMotion(320, 480, 80);
    const longDistance = getMarqueeMotion(1280, 920, 80);

    expect(longDistance.durationSeconds).toBeGreaterThan(shortDistance.durationSeconds);
    expectMotionSpeed(shortDistance, 800, 80);
    expectMotionSpeed(longDistance, 2200, 80);
  });

  it("keeps speed stable for the same pixels-per-second setting", () => {
    const first = getMarqueeMotion(480, 720, 120);
    const second = getMarqueeMotion(960, 1080, 120);

    expectMotionSpeed(first, 1200, 120);
    expectMotionSpeed(second, 2040, 120);
  });

  it("uses a longer reduced-motion duration while keeping the ticker animated", () => {
    const motion = getMarqueeMotion(400, 600, 80);

    expect(motion.reducedMotionDurationSeconds).toBeGreaterThan(motion.durationSeconds);
    expect(1000 / motion.reducedMotionDurationSeconds).toBeLessThan(80);
  });

  it("renders UrgentMarqueeSection as a right-to-left ticker that starts offscreen", () => {
    const restoreMeasurements = mockMarqueeMeasurements({ viewportWidth: 360, trackWidth: 640 });

    render(
      <UrgentMarqueeSection
        settings={{
          ...DEFAULT_HOMEPAGE_SETTINGS.marquee,
          enabled: true,
          label: "Notice",
          text: "Campus announcement",
          speedSeconds: 60
        }}
      />
    );

    expect(screen.getByRole("region", { name: "ประกาศด่วน" })).toBeInTheDocument();
    expect(screen.getByText("Notice")).toBeInTheDocument();

    const marqueeTrack = document.querySelector(".rcat-marquee-track") as HTMLElement;
    const injectedStyles = (document.head.textContent || "").replace(/\s/g, "");

    expect(screen.getByTestId("urgent-marquee-group")).toHaveTextContent("Campus announcement");
    expect(marqueeTrack).toBeInTheDocument();
    expect(document.querySelector(".rcat-marquee-viewport")).toBeInTheDocument();
    expect(marqueeTrack.style.getPropertyValue("--rcat-marquee-start-x")).toBe("360px");
    expect(marqueeTrack.style.getPropertyValue("--rcat-marquee-end-x")).toBe("-640px");
    expect(marqueeTrack.style.getPropertyValue("--rcat-marquee-duration")).toBe("12.5s");
    expect(marqueeTrack.style.getPropertyValue("--rcat-marquee-reduced-motion-duration")).toBe("25s");
    expect(injectedStyles).toContain("translateX(var(--rcat-marquee-start-x))");
    expect(injectedStyles).toContain("translateX(var(--rcat-marquee-end-x))");
    expect(injectedStyles).toContain("animation-duration:var(--rcat-marquee-duration)");
    expect(injectedStyles).toContain("animation-timing-function:linear");
    expect(injectedStyles).toContain("animation-iteration-count:infinite");
    expect(injectedStyles).toContain("animation-delay:0s");
    expect(injectedStyles).toContain("animation-play-state:paused");
    expect(injectedStyles).toContain("will-change:transform");
    expect(injectedStyles).toContain("prefers-reduced-motion:reduce");
    expect(injectedStyles).toContain("animation-duration:var(--rcat-marquee-reduced-motion-duration)");
    expect(injectedStyles).not.toContain("animation:none");
    expect(injectedStyles).not.toContain("animation:none!important");
    expect(injectedStyles).not.toContain("animation-name:none");
    restoreMeasurements();
  });

  it("falls back to a calm marquee speed when speedSeconds is invalid", () => {
    render(
      <UrgentMarqueeSection
        settings={{
          ...DEFAULT_HOMEPAGE_SETTINGS.marquee,
          enabled: true,
          label: "Notice",
          text: "Campus announcement",
          speedSeconds: Number.NaN
        }}
      />
    );

    const marqueeTrack = document.querySelector(".rcat-marquee-track") as HTMLElement;

    expect(marqueeTrack.style.getPropertyValue("--rcat-marquee-duration")).toBe("60s");
    expect(marqueeTrack.style.getPropertyValue("--rcat-marquee-reduced-motion-duration")).toBe("120s");
  });

  it("slows reduced-motion marquee speed while keeping the ticker animated", () => {
    render(
      <UrgentMarqueeSection
        settings={{
          ...DEFAULT_HOMEPAGE_SETTINGS.marquee,
          enabled: true,
          label: "Notice",
          text: "Campus announcement",
          speedSeconds: 180
        }}
      />
    );

    const marqueeTrack = document.querySelector(".rcat-marquee-track") as HTMLElement;
    const injectedStyles = (document.head.textContent || "").replace(/\s/g, "");

    expect(injectedStyles).toContain("prefers-reduced-motion:reduce");
    expect(
      Number.parseFloat(marqueeTrack.style.getPropertyValue("--rcat-marquee-reduced-motion-duration"))
    ).toBeGreaterThan(Number.parseFloat(marqueeTrack.style.getPropertyValue("--rcat-marquee-duration")));
    expect(injectedStyles).toContain("animation-duration:var(--rcat-marquee-reduced-motion-duration)");
    expect(injectedStyles).not.toContain("animation:none");
  });

  it("does not render HomeIntroVideoSection when disabled or youtubeEmbedUrl is empty", () => {
    expect(
      render(<HomeIntroVideoSection settings={DEFAULT_HOMEPAGE_SETTINGS.introVideo} />).container.firstChild
    ).toBeNull();

    expect(
      render(
        <HomeIntroVideoSection
          settings={{
            ...DEFAULT_HOMEPAGE_SETTINGS.introVideo,
            enabled: true
          }}
        />
      ).container.firstChild
    ).toBeNull();
  });

  it("defers the intro video iframe until it is near the viewport", async () => {
    let intersectionCallback: IntersectionObserverCallback | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();

    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn((callback: IntersectionObserverCallback) => {
        intersectionCallback = callback;

        return {
          disconnect,
          observe,
          takeRecords: () => [],
          unobserve: vi.fn(),
          root: null,
          rootMargin: "600px 0px",
          thresholds: []
        };
      })
    );

    render(
      <HomeIntroVideoSection
        settings={{
          enabled: true,
          title: "Intro video",
          youtubeEmbedUrl: "https://www.youtube-nocookie.com/embed/example"
        }}
      />
    );

    expect(screen.queryByTitle("Intro video")).not.toBeInTheDocument();

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(await screen.findByTitle("Intro video")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/example"
    );
    expect(observe).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it("does not render PublicHomeCarousel when no slides exist", () => {
    expect(render(<PublicHomeCarousel slides={[]} />).container.firstChild).toBeNull();
  });

  it("renders PublicHomeCarousel from a provided carousel slide", () => {
    const slides: CarouselSlide[] = [
      {
        id: "carousel-1",
        title: "Campus highlight",
        subtitle: "A real CMS carousel slide",
        chip: "Homepage",
        imageUrl: "https://example.edu/banner.jpg",
        imageAlt: "Campus banner",
        buttonLabel: "Read more",
        href: "/content/campus-highlight",
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
    ];

    render(<PublicHomeCarousel slides={slides} />);

    expect(screen.getByRole("img", { name: "Campus banner" })).toHaveAttribute("src", "https://example.edu/banner.jpg");
    expect(screen.queryByText("Campus highlight")).not.toBeInTheDocument();
    expect(screen.queryByText("A real CMS carousel slide")).not.toBeInTheDocument();
    expect(screen.queryByText("Homepage")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Read more" })).not.toBeInTheDocument();
  });

  it("renders PublicHomeCarousel when a visible slide has only an image URL", () => {
    const slides: CarouselSlide[] = [
      {
        id: "carousel-1",
        title: "",
        subtitle: "",
        chip: "",
        imageUrl: "https://example.edu/ceremony.jpg",
        imageAlt: "",
        buttonLabel: "",
        href: "",
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
    ];

    render(<PublicHomeCarousel slides={slides} />);

    expect(screen.getByRole("img", { name: "ภาพสไลด์หน้าแรก" })).toHaveAttribute(
      "src",
      "https://example.edu/ceremony.jpg"
    );
  });

  it("prioritizes the initially rendered PublicHomeCarousel image", () => {
    const slides: CarouselSlide[] = [
      {
        id: "carousel-1",
        title: "Campus highlight",
        subtitle: "A real CMS carousel slide",
        chip: "Homepage",
        imageUrl: "https://example.edu/banner-1.jpg",
        imageAlt: "Campus banner",
        buttonLabel: "Read more",
        href: "/content/campus-highlight",
        imageFit: "fit-blur",
        focalPointX: 50,
        focalPointY: 50,
        mobileImageUrl: "",
        backgroundColor: "",
        openInNewTab: false,
        enabled: true,
        order: 1,
        updatedAt: "2026-05-10T00:00:00.000Z"
      },
      {
        id: "carousel-2",
        title: "Student showcase",
        subtitle: "Another CMS carousel slide",
        chip: "Homepage",
        imageUrl: "https://example.edu/banner-2.jpg",
        imageAlt: "Student banner",
        buttonLabel: "Open",
        href: "/content/student-showcase",
        imageFit: "fit-blur",
        focalPointX: 50,
        focalPointY: 50,
        mobileImageUrl: "",
        backgroundColor: "",
        openInNewTab: false,
        enabled: true,
        order: 2,
        updatedAt: "2026-05-10T00:00:00.000Z"
      }
    ];

    render(<PublicHomeCarousel slides={slides} />);

    const carouselImages = screen.getAllByRole("img");

    expect(carouselImages).toHaveLength(1);
    expect(carouselImages[0]).toHaveAttribute("loading", "eager");
    expect(carouselImages[0]).toHaveAttribute("fetchpriority", "high");
    expect(carouselImages[0]).toHaveAttribute("decoding", "async");
  });

  it("only starts carousel autoplay when enabled and multiple slides are visible", () => {
    expect(shouldStartCarouselAutoplay(false, 2)).toBe(false);
    expect(shouldStartCarouselAutoplay(true, 1)).toBe(false);
    expect(shouldStartCarouselAutoplay(true, 2)).toBe(true);
  });

  it("does not render ExternalServicesSection when no service links exist", () => {
    expect(render(<ExternalServicesSection items={[]} />).container.firstChild).toBeNull();
  });

  it("renders ExternalServicesSection from provided service links", () => {
    const items: ExternalServiceLink[] = [
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
    ];

    render(<ExternalServicesSection items={items} />);

    expect(screen.getByText("Student portal")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิดลิงก์บริการ Student portal" })).toHaveAttribute(
      "href",
      "https://services.example.edu/student"
    );
  });

  it("does not render AchievementHighlightsSection when no achievement content exists", () => {
    expect(render(<AchievementHighlightsSection items={[]} />).container.firstChild).toBeNull();
  });

  it("renders AchievementHighlightsSection from provided content", () => {
    const items: ContentItem[] = [
      {
        id: "achievement-1",
        title: "Regional award winner",
        slug: "regional-award-winner",
        type: "news",
        status: "published",
        owner: "Admin",
        summary: "A real CMS achievement highlight.",
        category: "achievement",
        updatedAt: "2026-05-10T00:00:00.000Z",
        publishAt: "2026-05-10T00:00:00.000Z"
      }
    ];

    render(<AchievementHighlightsSection items={items} />);

    expect(screen.getByText("Regional award winner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "อ่านผลงาน Regional award winner" })).toHaveAttribute(
      "href",
      "/content/regional-award-winner"
    );
  });

  it("does not render VisitorStatsCard when disabled", () => {
    expect(
      render(
        <VisitorStatsCard
          stats={{
            enabled: false,
            usersToday: 0,
            usersYesterday: 0,
            usersThisMonth: 0,
            usersThisYear: 0,
            totalUsers: 0,
            totalViews: 0,
            onlineUsers: 0,
            updatedAt: ""
          }}
        />
      ).container.firstChild
    ).toBeNull();
  });

  it("renders VisitorStatsCard labels when enabled", () => {
    render(
      <VisitorStatsCard
        stats={{
          enabled: true,
          usersToday: 1,
          usersYesterday: 2,
          usersThisMonth: 3,
          usersThisYear: 4,
          totalUsers: 5,
          totalViews: 6,
          onlineUsers: 7,
          updatedAt: "2026-05-10T00:00:00.000Z"
        }}
      />
    );

    expect(screen.getByRole("region", { name: "Website Visitors" })).toBeInTheDocument();
    expect(screen.getByText("Website Visitors")).toBeInTheDocument();
    expect(screen.getByText("สถิติผู้เข้าชมเว็บไซต์")).toBeInTheDocument();
    expect(screen.getByText(/^Updated/)).toBeInTheDocument();

    [
      "Users Today",
      "Users Yesterday",
      "Users This Month",
      "Users This Year",
      "Total Users",
      "Total views",
      "Who's Online"
    ].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
  });

  it("does not render FloatingMessengerButton when disabled or missing href", () => {
    expect(render(<FloatingMessengerButton />).container.firstChild).toBeNull();
    expect(render(<FloatingMessengerButton enabled />).container.firstChild).toBeNull();
  });

  it("renders FloatingMessengerButton from provided settings", () => {
    render(<FloatingMessengerButton enabled href="https://m.me/rcat" label="สอบถามข้อมูล" />);

    expect(screen.getByText("สอบถามข้อมูล")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "สอบถามข้อมูลผ่าน Messenger" })).toHaveAttribute(
      "href",
      "https://m.me/rcat"
    );
  });

  it("does not render ContactMapCard without contact info or map settings", () => {
    expect(render(<ContactMapCard siteSettings={defaultSiteSettings} />).container.firstChild).toBeNull();
  });

  it("renders ContactMapCard contact info without requiring a map", () => {
    render(
      <ContactMapCard
        siteSettings={{
          ...defaultSiteSettings,
          campus: "Real campus",
          phone: "02-000-0000"
        }}
      />
    );

    expect(screen.getByText("Real campus")).toBeInTheDocument();
    expect(screen.getByText("02-000-0000")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "เปิดแผนที่ใน Google Maps" })).not.toBeInTheDocument();
    expect(screen.queryByTitle(/แผนที่/)).not.toBeInTheDocument();
  });

  it("defers the ContactMapCard map iframe until it is near the viewport", async () => {
    let intersectionCallback: IntersectionObserverCallback | undefined;

    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn((callback: IntersectionObserverCallback) => {
        intersectionCallback = callback;

        return {
          disconnect: vi.fn(),
          observe: vi.fn(),
          takeRecords: () => [],
          unobserve: vi.fn(),
          root: null,
          rootMargin: "600px 0px",
          thresholds: []
        };
      })
    );

    render(
      <ContactMapCard
        siteSettings={{
          ...defaultSiteSettings,
          campus: "Real campus",
          mapEmbedUrl: "https://www.google.com/maps/embed?pb=test",
          mapUrl: "https://www.google.com/maps/place/example"
        }}
      />
    );

    expect(screen.queryByTitle(/Real campus/)).not.toBeInTheDocument();

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(await screen.findByTitle(/Real campus/)).toHaveAttribute("src", "https://www.google.com/maps/embed?pb=test");
  });
});
