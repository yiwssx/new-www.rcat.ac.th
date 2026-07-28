import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicHomeCarousel from "../public/components/PublicHomeCarousel";
import { shouldStartCarouselAutoplay } from "../public/utils/homeCarousel";
import { CarouselSlide, HomepageCarouselSettings } from "../types";

const emblaApiMock = vi.hoisted(() => ({
  on: vi.fn(),
  off: vi.fn(),
  reInit: vi.fn(),
  scrollNext: vi.fn(),
  scrollPrev: vi.fn(),
  scrollTo: vi.fn(),
  selectedScrollSnap: vi.fn(() => 0)
}));

vi.mock("embla-carousel-react", () => ({
  default: () => [vi.fn(), emblaApiMock]
}));

const originalMatchMedia = window.matchMedia;
const originalVisibilityStateDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");

function setDocumentVisibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value
  });
}

function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string): MediaQueryList => ({
    matches: query === "(prefers-reduced-motion: reduce)" ? matches : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false)
  }));
}

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

function createTwoSlides() {
  return [
    createSlide({
      id: "slide-1",
      title: "First slide",
      imageAlt: "First slide"
    }),
    createSlide({
      id: "slide-2",
      title: "Second slide",
      imageAlt: "Second slide",
      imageUrl: "https://example.edu/slide-2.jpg",
      order: 2
    })
  ];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-16T09:00:00.000Z"));
  setDocumentVisibility("visible");
  setReducedMotion(false);

  emblaApiMock.on.mockClear();
  emblaApiMock.off.mockClear();
  emblaApiMock.reInit.mockClear();
  emblaApiMock.scrollNext.mockClear();
  emblaApiMock.scrollPrev.mockClear();
  emblaApiMock.scrollTo.mockClear();
  emblaApiMock.selectedScrollSnap.mockReset();
  emblaApiMock.selectedScrollSnap.mockReturnValue(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.matchMedia = originalMatchMedia;

  if (originalVisibilityStateDescriptor) {
    Object.defineProperty(document, "visibilityState", originalVisibilityStateDescriptor);
  }
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

    expect(
      screen.getByRole("img", {
        name: "ภาพสไลด์หน้าแรก"
      })
    ).toHaveAttribute("src", "https://example.edu/slide-1.jpg");
    expect(screen.queryByText("Legacy subtitle")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy chip")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", {
        name: "Legacy CTA"
      })
    ).not.toBeInTheDocument();
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
    const image = screen.getByRole("img", {
      name: "Feature poster"
    });

    expect(stage).toHaveAttribute("data-carousel-image-fit", "fill");
    expect(image).toHaveAttribute("data-carousel-object-fit", "cover");
    expect(image).toHaveAttribute("data-carousel-object-position", "30% 15%");
  });

  it("gives every slide the same fixed responsive stage contract", () => {
    const { container } = render(<PublicHomeCarousel slides={createTwoSlides()} />);

    const stages = container.querySelectorAll('[data-carousel-slide-stage="true"]');

    expect(stages).toHaveLength(2);
    stages.forEach((stage) => {
      expect(stage).toHaveAttribute("data-carousel-stage-sizing", "fixed-responsive");
    });
  });

  it("loads only the selected image initially and preloads the next image at low priority after load", () => {
    render(<PublicHomeCarousel slides={createTwoSlides()} />);

    const firstImage = screen.getByRole("img", {
      name: "First slide"
    });

    expect(firstImage).toHaveAttribute("loading", "eager");
    expect(firstImage).toHaveAttribute("fetchpriority", "high");
    expect(firstImage).toHaveAttribute("decoding", "async");
    expect(
      screen.queryByRole("img", {
        name: "Second slide",
        hidden: true
      })
    ).not.toBeInTheDocument();

    fireEvent.load(firstImage);
    act(() => {
      vi.advanceTimersByTime(120);
    });

    const secondImage = screen.getByRole("img", {
      name: "Second slide",
      hidden: true
    });

    expect(secondImage).toHaveAttribute("loading", "lazy");
    expect(secondImage).toHaveAttribute("fetchpriority", "auto");
    expect(secondImage).toHaveAttribute("decoding", "async");
  });

  it("keeps distant slides source-free until direct navigation requests the destination", () => {
    const slides = Array.from({ length: 5 }, (_, index) =>
      createSlide({
        id: `slide-${index + 1}`,
        title: `Slide ${index + 1}`,
        imageAlt: `Slide ${index + 1}`,
        imageUrl: `https://example.edu/slide-${index + 1}.jpg`,
        order: index + 1
      })
    );

    render(<PublicHomeCarousel slides={slides} settings={createSettings({ autoplayEnabled: false })} />);

    expect(screen.getAllByRole("img", { hidden: true })).toHaveLength(1);
    expect(screen.queryByRole("img", { name: "Slide 5", hidden: true })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ไปยังสไลด์ 5" }));

    const distantImage = screen.getByRole("img", { name: "Slide 5", hidden: true });
    expect(distantImage).toHaveAttribute("src", "https://example.edu/slide-5.jpg");
    expect(distantImage).toHaveAttribute("loading", "lazy");
    expect(distantImage).toHaveAttribute("fetchpriority", "auto");
  });

  it("uses looped indexes when requesting the previous slide from the first position", () => {
    const slides = Array.from({ length: 5 }, (_, index) =>
      createSlide({
        id: `loop-${index + 1}`,
        title: `Loop ${index + 1}`,
        imageAlt: `Loop ${index + 1}`,
        imageUrl: `https://example.edu/loop-${index + 1}.jpg`,
        order: index + 1
      })
    );

    render(<PublicHomeCarousel slides={slides} settings={createSettings({ autoplayEnabled: false })} />);

    fireEvent.click(screen.getByRole("button", { name: "สไลด์ก่อนหน้า" }));

    expect(screen.getByRole("img", { name: "Loop 5", hidden: true })).toHaveAttribute(
      "src",
      "https://example.edu/loop-5.jpg"
    );
  });

  it("uses a normalized Google Drive URL and responsive candidates", () => {
    render(
      <PublicHomeCarousel
        slides={[
          createSlide({
            imageAlt: "Drive slide",
            imageUrl: "https://drive.google.com/file/d/RCAT_carousel-2026_ABC123/view?usp=sharing"
          })
        ]}
      />
    );

    const image = screen.getByRole("img", {
      name: "Drive slide"
    });

    expect(image).toHaveAttribute("src", "https://drive.google.com/thumbnail?id=RCAT_carousel-2026_ABC123&sz=w1600");
    expect(image).toHaveAttribute("sizes", "(max-width: 900px) 100vw, 1536px");
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
  });

  it("hides all navigation and autoplay controls when only one slide exists", () => {
    const { container } = render(
      <PublicHomeCarousel
        slides={[
          createSlide({
            imageAlt: "Only slide"
          })
        ]}
        settings={createSettings()}
      />
    );

    expect(
      screen.getByRole("img", {
        name: "Only slide"
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "สไลด์ก่อนหน้า"
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "สไลด์ถัดไป"
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "หยุดสไลด์อัตโนมัติ"
      })
    ).not.toBeInTheDocument();
    expect(container.querySelector('[data-carousel-dot-controls="true"]')).not.toBeInTheDocument();
  });

  it("honors showArrows and showDots independently", () => {
    const { container, rerender } = render(
      <PublicHomeCarousel
        settings={createSettings({
          showArrows: false,
          showDots: true
        })}
        slides={createTwoSlides()}
      />
    );

    expect(container.querySelector('[data-carousel-arrow-controls="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-carousel-dot-controls="true"]')).toBeInTheDocument();

    rerender(
      <PublicHomeCarousel
        settings={createSettings({
          showArrows: true,
          showDots: false
        })}
        slides={createTwoSlides()}
      />
    );

    expect(container.querySelector('[data-carousel-arrow-controls="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-carousel-dot-controls="true"]')).not.toBeInTheDocument();
  });

  it("pauses on hover only when pauseOnHover is enabled", () => {
    const { container, rerender } = render(
      <PublicHomeCarousel
        settings={createSettings({
          pauseOnHover: true,
          pauseOnFocus: false
        })}
        slides={createTwoSlides()}
      />
    );

    const carousel = container.querySelector('[data-public-home-carousel="true"]');

    expect(vi.getTimerCount()).toBe(1);

    fireEvent.mouseEnter(carousel as Element);
    expect(vi.getTimerCount()).toBe(0);

    fireEvent.mouseLeave(carousel as Element);
    expect(vi.getTimerCount()).toBe(1);

    rerender(
      <PublicHomeCarousel
        settings={createSettings({
          pauseOnHover: false,
          pauseOnFocus: false
        })}
        slides={createTwoSlides()}
      />
    );

    fireEvent.mouseEnter(carousel as Element);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("pauses while keyboard focus is inside only when pauseOnFocus is enabled", () => {
    const { container, rerender } = render(
      <PublicHomeCarousel
        settings={createSettings({
          pauseOnHover: false,
          pauseOnFocus: true
        })}
        slides={createTwoSlides()}
      />
    );

    const carousel = container.querySelector('[data-public-home-carousel="true"]');

    expect(vi.getTimerCount()).toBe(1);

    fireEvent.focus(carousel as Element);
    expect(vi.getTimerCount()).toBe(0);

    fireEvent.blur(carousel as Element, {
      relatedTarget: document.body
    });
    expect(vi.getTimerCount()).toBe(1);

    rerender(
      <PublicHomeCarousel
        settings={createSettings({
          pauseOnHover: false,
          pauseOnFocus: false
        })}
        slides={createTwoSlides()}
      />
    );

    fireEvent.focus(carousel as Element);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("stops autoplay after pointer interaction and allows an explicit resume", () => {
    const { container } = render(
      <PublicHomeCarousel
        settings={createSettings({
          pauseOnFocus: false
        })}
        slides={createTwoSlides()}
      />
    );

    const viewport = container.querySelector('[data-carousel-viewport="true"]');

    expect(vi.getTimerCount()).toBe(1);

    fireEvent.pointerDown(viewport as Element, {
      clientX: 180,
      pointerType: "touch"
    });

    expect(vi.getTimerCount()).toBe(0);
    expect(
      screen.getByRole("button", {
        name: "เล่นสไลด์อัตโนมัติ"
      })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "เล่นสไลด์อัตโนมัติ"
      })
    );

    expect(vi.getTimerCount()).toBe(1);
    expect(
      screen.getByRole("button", {
        name: "หยุดสไลด์อัตโนมัติ"
      })
    ).toBeInTheDocument();
  });

  it("supports keyboard navigation from the carousel region and pauses autoplay", () => {
    const { container } = render(
      <PublicHomeCarousel
        settings={createSettings({
          pauseOnFocus: false
        })}
        slides={createTwoSlides()}
      />
    );

    const carousel = container.querySelector('[data-public-home-carousel="true"]');

    fireEvent.keyDown(carousel as Element, {
      key: "ArrowRight"
    });

    expect(emblaApiMock.scrollNext).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(
      screen.getByRole("button", {
        name: "เล่นสไลด์อัตโนมัติ"
      })
    ).toBeInTheDocument();
  });

  it("does not autoplay when reduced motion is requested", () => {
    setReducedMotion(true);

    const { container } = render(<PublicHomeCarousel settings={createSettings()} slides={createTwoSlides()} />);

    expect(vi.getTimerCount()).toBe(0);
    expect(container.querySelector('[data-carousel-autoplay-state="reduced-motion"]')).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "การเล่นสไลด์อัตโนมัติถูกปิดตามการตั้งค่าลดการเคลื่อนไหว"
      })
    ).toBeDisabled();
  });

  it("pauses while the document is hidden and resumes when visible", () => {
    setDocumentVisibility("hidden");

    const { container } = render(
      <PublicHomeCarousel
        settings={createSettings({
          pauseOnFocus: false
        })}
        slides={createTwoSlides()}
      />
    );

    expect(vi.getTimerCount()).toBe(0);
    expect(container.querySelector('[data-carousel-autoplay-state="paused"]')).toBeInTheDocument();

    act(() => {
      setDocumentVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(vi.getTimerCount()).toBe(1);
  });

  it("supports fade transition without using Embla navigation for control clicks", () => {
    const { container } = render(
      <PublicHomeCarousel
        settings={createSettings({
          autoplayEnabled: false,
          transition: "fade"
        })}
        slides={createTwoSlides()}
      />
    );

    const carousel = container.querySelector('[data-public-home-carousel="true"]');
    const firstSlide = container.querySelector('[data-carousel-slide-index="0"]');
    const secondSlide = container.querySelector('[data-carousel-slide-index="1"]');

    expect(carousel).toHaveAttribute("data-carousel-transition", "fade");
    expect(firstSlide).toHaveAttribute("data-carousel-slide-selected", "true");
    expect(secondSlide).toHaveAttribute("data-carousel-slide-selected", "false");

    fireEvent.click(
      screen.getByRole("button", {
        name: "สไลด์ถัดไป"
      })
    );

    expect(emblaApiMock.scrollNext).not.toHaveBeenCalled();
    expect(firstSlide).toHaveAttribute("data-carousel-slide-selected", "false");
    expect(secondSlide).toHaveAttribute("data-carousel-slide-selected", "true");
  });

  it("updates scheduled slides while the page remains open", () => {
    render(
      <PublicHomeCarousel
        settings={createSettings({
          autoplayEnabled: false
        })}
        slides={[
          createSlide({
            imageAlt: "Scheduled slide",
            startAt: "2026-07-16T09:00:01.000Z"
          })
        ]}
      />
    );

    expect(
      screen.queryByRole("img", {
        name: "Scheduled slide"
      })
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(
      screen.getByRole("img", {
        name: "Scheduled slide"
      })
    ).toBeInTheDocument();
  });

  it("starts autoplay only when enabled and more than one slide exists", () => {
    expect(shouldStartCarouselAutoplay(true, 1)).toBe(false);
    expect(shouldStartCarouselAutoplay(true, 2)).toBe(true);
    expect(shouldStartCarouselAutoplay(false, 2)).toBe(false);
  });
});
