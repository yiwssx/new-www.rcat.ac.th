import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicHomeCarousel from "../public/components/PublicHomeCarousel";
import { shouldStartCarouselAutoplay } from "../public/utils/homeCarousel";
import { CarouselSlide } from "../types";

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
    enabled: true,
    order: 1,
    updatedAt: "2026-05-10T00:00:00.000Z",
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

  it("hides navigation controls and dots when only one visible slide exists", () => {
    render(<PublicHomeCarousel slides={[createSlide({ imageAlt: "Only slide" })]} />);

    expect(screen.getByRole("img", { name: "Only slide" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "สไลด์ก่อนหน้า" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "สไลด์ถัดไป" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ไปยังสไลด์ 1" })).not.toBeInTheDocument();
  });

  it("shows previous/next controls and dot buttons when multiple visible slides exist", () => {
    render(
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
  });

  it("starts autoplay only when enabled and more than one visible slide exists", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    const { unmount } = render(
      <PublicHomeCarousel
        settings={{ autoplayEnabled: false, autoplayIntervalSeconds: 5 }}
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
        settings={{ autoplayEnabled: true, autoplayIntervalSeconds: 5 }}
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
        settings={{ autoplayEnabled: true, autoplayIntervalSeconds: 5 }}
        slides={[createSlide({ imageAlt: "Only slide" })]}
      />
    );

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(shouldStartCarouselAutoplay(true, 1)).toBe(false);
    expect(shouldStartCarouselAutoplay(true, 2)).toBe(true);
    expect(shouldStartCarouselAutoplay(false, 2)).toBe(false);
  });
});
