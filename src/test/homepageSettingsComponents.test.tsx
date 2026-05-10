import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicHomeCarousel from "../public/components/PublicHomeCarousel";
import PublicIntroGate from "../public/components/PublicIntroGate";
import { ExternalServicesSection } from "../public/components/home/ExternalServicesSection";
import { HomeIntroVideoSection } from "../public/components/home/HomeIntroVideoSection";
import { UrgentMarqueeSection } from "../public/components/home/UrgentMarqueeSection";
import { DEFAULT_HOMEPAGE_SETTINGS } from "../services/homepageSettings";
import { CarouselSlide, ExternalServiceLink } from "../types";

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
});
