import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicHomeCarousel from "../public/components/PublicHomeCarousel";
import PublicIntroGate from "../public/components/PublicIntroGate";
import { HomeIntroVideoSection } from "../public/components/home/HomeIntroVideoSection";
import { UrgentMarqueeSection } from "../public/components/home/UrgentMarqueeSection";
import { DEFAULT_HOMEPAGE_SETTINGS } from "../services/homepageSettings";
import { CarouselSlide } from "../types";

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
});
