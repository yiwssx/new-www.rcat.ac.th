import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicHomeCarousel from "../public/components/PublicHomeCarousel";
import PublicIntroGate from "../public/components/PublicIntroGate";
import { PublicMediaLoadingProvider } from "../shared/media/PublicMediaLoadingContext";
import type { CarouselSlide, HomepageIntroGateSettings } from "../types";

const introSettings: HomepageIntroGateSettings = {
  enabled: true,
  imageUrl: "https://images.example.edu/intro.jpg",
  imageAlt: "Intro critical",
  primaryButtonLabel: "Enter",
  secondaryButtonLabel: "",
  secondaryButtonUrl: "",
  storageKey: "priority-coordination"
};

const carouselSlide: CarouselSlide = {
  id: "slide-1",
  title: "Carousel critical",
  subtitle: "",
  chip: "",
  imageUrl: "https://images.example.edu/carousel.jpg",
  imageAlt: "Carousel critical",
  buttonLabel: "",
  href: "",
  imageFit: "fill",
  focalPointX: 50,
  focalPointY: 50,
  mobileImageUrl: "",
  backgroundColor: "",
  openInNewTab: false,
  enabled: true,
  order: 1,
  updatedAt: "2026-07-28T00:00:00.000Z"
};

describe("Public critical media priority coordination", () => {
  it("gives the Intro Gate sole critical ownership, then promotes the Carousel without a reload", async () => {
    const { rerender } = render(
      <PublicMediaLoadingProvider pageMediaAllowed={false}>
        <PublicIntroGate settings={introSettings} visible onDismiss={() => undefined} />
        <PublicHomeCarousel slides={[carouselSlide]} />
      </PublicMediaLoadingProvider>
    );

    const introImage = screen.getByRole("img", { name: "Intro critical" });
    expect(introImage).toHaveAttribute("fetchpriority", "high");
    expect(screen.queryByRole("img", { name: "Carousel critical" })).not.toBeInTheDocument();
    expect(document.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(1);

    rerender(
      <PublicMediaLoadingProvider pageMediaAllowed>
        <PublicIntroGate settings={introSettings} visible={false} onDismiss={() => undefined} />
        <PublicHomeCarousel slides={[carouselSlide]} />
      </PublicMediaLoadingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Carousel critical" })).toHaveAttribute("fetchpriority", "high");
    });
    expect(screen.queryByRole("img", { name: "Intro critical" })).not.toBeInTheDocument();
    expect(document.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(1);
  });
});
