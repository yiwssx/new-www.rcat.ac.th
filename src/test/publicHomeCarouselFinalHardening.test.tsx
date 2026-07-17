import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicHomeCarousel from "../public/components/PublicHomeCarousel";
import type { CarouselSlide, HomepageCarouselSettings } from "../types";

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

function createSlide(id: string, order: number): CarouselSlide {
  return {
    id,
    title: `Slide ${order}`,
    subtitle: "",
    chip: "",
    imageUrl: `https://example.edu/${id}.jpg`,
    imageAlt: `Slide ${order}`,
    buttonLabel: "",
    href: "",
    imageFit: "fit-blur",
    focalPointX: 50,
    focalPointY: 50,
    mobileImageUrl: "",
    backgroundColor: "",
    openInNewTab: false,
    enabled: true,
    order,
    updatedAt: "2026-07-17T00:00:00.000Z"
  };
}

const settings: HomepageCarouselSettings = {
  autoplayEnabled: true,
  autoplayIntervalSeconds: 5,
  showArrows: true,
  showDots: true,
  pauseOnHover: false,
  pauseOnFocus: false,
  transition: "fade"
};

beforeEach(() => {
  vi.useFakeTimers();
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
});

describe("PublicHomeCarousel final hardening", () => {
  it("toggles autoplay once per command under React Strict Mode", () => {
    render(
      <StrictMode>
        <PublicHomeCarousel slides={[createSlide("slide-1", 1), createSlide("slide-2", 2)]} settings={settings} />
      </StrictMode>
    );

    expect(vi.getTimerCount()).toBe(1);

    fireEvent.click(
      screen.getByRole("button", {
        name: "หยุดสไลด์อัตโนมัติ"
      })
    );

    expect(vi.getTimerCount()).toBe(0);
    expect(
      screen.getByRole("button", {
        name: "เล่นสไลด์อัตโนมัติ"
      })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("หยุดการเล่นสไลด์อัตโนมัติแล้ว")).toBeInTheDocument();

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
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("เริ่มการเล่นสไลด์อัตโนมัติแล้ว")).toBeInTheDocument();
  });

  it("exposes a truthful disabled control state for reduced motion", () => {
    setReducedMotion(true);

    const { container } = render(
      <PublicHomeCarousel slides={[createSlide("slide-1", 1), createSlide("slide-2", 2)]} settings={settings} />
    );

    const carousel = container.querySelector('[data-public-home-carousel="true"]');

    expect(carousel).toHaveAttribute("data-carousel-autoplay-state", "reduced-motion");
    expect(vi.getTimerCount()).toBe(0);

    const control = screen.getByRole("button", {
      name: "การเล่นสไลด์อัตโนมัติถูกปิดตามการตั้งค่าลดการเคลื่อนไหว"
    });

    expect(control).toBeDisabled();
    expect(control).toHaveAttribute("aria-pressed", "true");
  });
});
