import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicHomeCarousel from "../public/components/PublicHomeCarousel";
import { shouldStartCarouselAutoplay } from "../public/utils/homeCarousel";
import { CarouselSlide, HomepageCarouselSettings } from "../types";

const emblaApiMock = vi.hoisted(() => ({
  on: vi.fn(),
  off: vi.fn(),
  scrollNext: vi.fn(),
  scrollPrev: vi.fn(),
  scrollTo: vi.fn(),
  selectedScrollSnap: vi.fn(() => 0)
}));

vi.mock("embla-carousel-react", () => ({
  default: () => [vi.fn(), emblaApiMock]
}));

function createSlide(overrides: Partial<CarouselSlide> = {}): CarouselSlide {
  return {
    id: "slide-1",
    title: "",
    subtitle: "",
    chip: "",
    imageUrl: "https://example.edu/slide-1.jpg",
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
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides
  };
}

function createSettings(overrides: Partial<HomepageCarouselSettings> = {}): HomepageCarouselSettings {
  return {
    autoplayEnabled: true,
    autoplayIntervalSeconds: 5,
    showArrows: true,
    showDots: true,
    pauseOnHover: true,
    pauseOnFocus: true,
    transition: "slide",
    ...overrides
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  emblaApiMock.on.mockClear();
  emblaApiMock.off.mockClear();
  emblaApiMock.scrollNext.mockClear();
  emblaApiMock.scrollPrev.mockClear();
  emblaApiMock.scrollTo.mockClear();
  emblaApiMock.selectedScrollSnap.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PublicHomeCarousel regressions", () => {
  it("renders an enabled image-only slide without old overlay marketing content", () => {
    render(
      <PublicHomeCarousel
        slides={[
          createSlide({
            title: "",
            subtitle: "Legacy subtitle",
            chip: "Legacy chip",
            buttonLabel: "Legacy CTA",
            href: "/content/legacy"
          })
        ]}
      />
    );

    expect(screen.getByRole("img", { name: "ภาพสไลด์หน้าแรก" })).toHaveAttribute(
      "src",
      "https://example.edu/slide-1.jpg"
    );
    expect(screen.queryByText("Legacy subtitle")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy chip")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Legacy CTA" })).not.toBeInTheDocument();
  });

  it("uses the shared image renderer and preserves the slide display contract", () => {
    const { container } = render(
      <PublicHomeCarousel
        slides={[
          createSlide({
            imageAlt: "Feature poster",
            imageFit: "fill",
            focalPointX: 30,
            focalPointY: 15
          })
        ]}
      />
    );

    const stage = container.querySelector('[data-carousel-image-stage="true"]');
    const image = screen.getByRole("img", { name: "Feature poster" });

    expect(stage).toHaveAttribute("data-carousel-image-fit", "fill");
    expect(image).toHaveAttribute("data-carousel-object-fit", "cover");
    expect(image).toHaveAttribute("data-carousel-object-position", "30% 15%");
  });

  it("gives every slide the same fixed responsive stage contract", () => {
    const { container } = render(
      <PublicHomeCarousel
        slides={[
          createSlide({ id: "slide-1", imageAlt: "Landscape slide" }),
          createSlide({
            id: "slide-2",
            imageAlt: "Portrait slide",
            imageUrl: "https://example.edu/portrait.jpg",
            imageFit: "fit",
            order: 2
          })
        ]}
      />
    );

    const stages = container.querySelectorAll('[data-carousel-slide-stage="true"]');

    expect(stages).toHaveLength(2);
    stages.forEach((stage) => {
      expect(stage).toHaveAttribute("data-carousel-stage-sizing", "fixed-responsive");
    });
  });

  it("marks the first image eager/high priority and later images lazy/auto priority", () => {
    render(
      <PublicHomeCarousel
        slides={[
          createSlide({ id: "slide-1", imageAlt: "First slide", imageUrl: "https://example.edu/slide-1.jpg" }),
          createSlide({
            id: "slide-2",
            imageAlt: "Second slide",
            imageUrl: "https://example.edu/slide-2.jpg",
            order: 2
          })
        ]}
      />
    );

    const firstImage = screen.getByRole("img", { name: "First slide" });
    const secondImage = screen.getByRole("img", { name: "Second slide" });

    expect(firstImage).toHaveAttribute("loading", "eager");
    expect(firstImage).toHaveAttribute("fetchpriority", "high");
    expect(firstImage).toHaveAttribute("decoding", "async");
    expect(secondImage).toHaveAttribute("loading", "lazy");
    expect(secondImage).toHaveAttribute("fetchpriority", "auto");
    expect(secondImage).toHaveAttribute("decoding", "async");
  });

  it("uses a normalized Google Drive URL and responsive candidates without changing first image priority", () => {
    render(
      <PublicHomeCarousel
        slides={[
          createSlide({
            id: "slide-1",
            imageAlt: "Drive slide",
            imageUrl: "https://drive.google.com/file/d/RCAT_carousel-2026_ABC123/view?usp=sharing"
          })
        ]}
      />
    );

    const image = screen.getByRole("img", { name: "Drive slide" });

    expect(image).toHaveAttribute("src", "https://drive.google.com/thumbnail?id=RCAT_carousel-2026_ABC123&sz=w1600");
    expect(image).toHaveAttribute(
      "srcset",
      [
        "https://drive.google.com/thumbnail?id=RCAT_carousel-2026_ABC123&sz=w640 640w",
        "https://drive.google.com/thumbnail?id=RCAT_carousel-2026_ABC123&sz=w900 900w",
        "https://drive.google.com/thumbnail?id=RCAT_carousel-2026_ABC123&sz=w1200 1200w",
        "https://drive.google.com/thumbnail?id=RCAT_carousel-2026_ABC123&sz=w1600 1600w"
      ].join(", ")
    );
    expect(image).toHaveAttribute("sizes", "(max-width: 900px) 100vw, 1536px");
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
  });

  it("hides all navigation controls when only one visible slide exists", () => {
    const { container } = render(<PublicHomeCarousel slides={[createSlide({ imageAlt: "Only slide" })]} />);

    expect(screen.getByRole("img", { name: "Only slide" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "สไลด์ก่อนหน้า" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "สไลด์ถัดไป" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ไปยังสไลด์ 1" })).not.toBeInTheDocument();
    expect(container.querySelector('[data-carousel-arrow-controls="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-carousel-dot-controls="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-carousel-control-scrim="true"]')).not.toBeInTheDocument();
  });

  it("shows readable arrow and dot control groups by default for multiple slides", () => {
    const { container } = render(
      <PublicHomeCarousel
        slides={[
          createSlide({ id: "slide-1", imageAlt: "First slide" }),
          createSlide({ id: "slide-2", imageAlt: "Second slide", imageUrl: "https://example.edu/slide-2.jpg" })
        ]}
      />
    );

    expect(screen.getByRole("button", { name: "สไลด์ก่อนหน้า" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "สไลด์ถัดไป" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ไปยังสไลด์ 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ไปยังสไลด์ 2" })).toBeInTheDocument();
    expect(container.querySelector('[data-carousel-arrow-controls="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-carousel-dot-controls="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-carousel-control-scrim="true"]')).toBeInTheDocument();
  });

  it("honors showArrows=false without hiding dots or the dot scrim", () => {
    const { container } = render(
      <PublicHomeCarousel
        settings={createSettings({ showArrows: false, showDots: true })}
        slides={[
          createSlide({ id: "slide-1", imageAlt: "First slide" }),
          createSlide({ id: "slide-2", imageAlt: "Second slide", imageUrl: "https://example.edu/slide-2.jpg" })
        ]}
      />
    );

    expect(screen.queryByRole("button", { name: "สไลด์ก่อนหน้า" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "สไลด์ถัดไป" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ไปยังสไลด์ 1" })).toBeInTheDocument();
    expect(container.querySelector('[data-carousel-arrow-controls="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-carousel-dot-controls="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-carousel-control-scrim="true"]')).toBeInTheDocument();
  });

  it("honors showDots=false without hiding arrows and removes the unused bottom scrim", () => {
    const { container } = render(
      <PublicHomeCarousel
        settings={createSettings({ showArrows: true, showDots: false })}
        slides={[
          createSlide({ id: "slide-1", imageAlt: "First slide" }),
          createSlide({ id: "slide-2", imageAlt: "Second slide", imageUrl: "https://example.edu/slide-2.jpg" })
        ]}
      />
    );

    expect(screen.getByRole("button", { name: "สไลด์ก่อนหน้า" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "สไลด์ถัดไป" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ไปยังสไลด์ 1" })).not.toBeInTheDocument();
    expect(container.querySelector('[data-carousel-arrow-controls="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-carousel-dot-controls="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-carousel-control-scrim="true"]')).not.toBeInTheDocument();
  });

  it("can hide both control groups while keeping the carousel images visible", () => {
    const { container } = render(
      <PublicHomeCarousel
        settings={createSettings({ showArrows: false, showDots: false })}
        slides={[
          createSlide({ id: "slide-1", imageAlt: "First slide" }),
          createSlide({ id: "slide-2", imageAlt: "Second slide", imageUrl: "https://example.edu/slide-2.jpg" })
        ]}
      />
    );

    expect(screen.getByRole("img", { name: "First slide" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Second slide" })).toBeInTheDocument();
    expect(container.querySelector('[data-carousel-arrow-controls="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-carousel-dot-controls="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-carousel-control-scrim="true"]')).not.toBeInTheDocument();
  });

  it("starts autoplay only when enabled and more than one visible slide exists", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    const { unmount } = render(
      <PublicHomeCarousel
        settings={createSettings({ autoplayEnabled: false })}
        slides={[
          createSlide({ id: "slide-1", imageAlt: "First slide" }),
          createSlide({ id: "slide-2", imageAlt: "Second slide", imageUrl: "https://example.edu/slide-2.jpg" })
        ]}
      />
    );

    expect(setIntervalSpy).not.toHaveBeenCalled();
    unmount();

    render(
      <PublicHomeCarousel
        settings={createSettings({ autoplayEnabled: true })}
        slides={[
          createSlide({ id: "slide-1", imageAlt: "First slide" }),
          createSlide({ id: "slide-2", imageAlt: "Second slide", imageUrl: "https://example.edu/slide-2.jpg" })
        ]}
      />
    );

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it("does not start autoplay for one visible slide even when enabled", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    render(
      <PublicHomeCarousel
        settings={createSettings({ autoplayEnabled: true })}
        slides={[createSlide({ imageAlt: "Only slide" })]}
      />
    );

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(shouldStartCarouselAutoplay(true, 1)).toBe(false);
    expect(shouldStartCarouselAutoplay(true, 2)).toBe(true);
    expect(shouldStartCarouselAutoplay(false, 2)).toBe(false);
  });
});
