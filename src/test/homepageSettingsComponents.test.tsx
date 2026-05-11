import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FloatingMessengerButton from "../public/components/FloatingMessengerButton";
import PublicHomeCarousel from "../public/components/PublicHomeCarousel";
import PublicIntroGate from "../public/components/PublicIntroGate";
import { AchievementHighlightsSection } from "../public/components/home/AchievementHighlightsSection";
import { ContactMapCard } from "../public/components/home/ContactMapCard";
import { ExternalServicesSection } from "../public/components/home/ExternalServicesSection";
import { HomeIntroVideoSection } from "../public/components/home/HomeIntroVideoSection";
import { UrgentMarqueeSection } from "../public/components/home/UrgentMarqueeSection";
import { VisitorStatsCard } from "../public/components/home/VisitorStatsCard";
import { DEFAULT_HOMEPAGE_SETTINGS } from "../services/homepageSettings";
import { defaultSiteSettings } from "../services/siteSettings";
import { CarouselSlide, ContentItem, ExternalServiceLink } from "../types";

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
        enabled: true,
        order: 1,
        updatedAt: "2026-05-10T00:00:00.000Z"
      }
    ];

    render(<PublicHomeCarousel slides={slides} />);

    expect(screen.getByText("Campus highlight")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read more" })).toHaveAttribute("href", "/content/campus-highlight");
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
});
