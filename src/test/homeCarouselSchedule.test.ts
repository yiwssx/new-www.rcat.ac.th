import { describe, expect, it } from "vitest";
import {
  getCarouselScheduleDelayMs,
  getNextCarouselScheduleBoundaryMs,
  isCarouselSlideActive,
  MAX_CAROUSEL_SCHEDULE_DELAY_MS
} from "../public/utils/homeCarousel";
import type { CarouselSlide } from "../types";

function createSlide(overrides: Partial<CarouselSlide> = {}): CarouselSlide {
  return {
    id: "slide-1",
    title: "Scheduled slide",
    subtitle: "",
    chip: "",
    imageUrl: "https://example.edu/slide.jpg",
    imageAlt: "Scheduled slide",
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
    updatedAt: "2026-07-16T00:00:00.000Z",
    ...overrides
  };
}

describe("home carousel schedule", () => {
  it("keeps a slide active through its exact end timestamp", () => {
    const endAt = "2026-07-16T10:00:00.000Z";
    const endMs = Date.parse(endAt);
    const slide = createSlide({ endAt });

    expect(isCarouselSlideActive(slide, endMs)).toBe(true);
    expect(isCarouselSlideActive(slide, endMs + 1)).toBe(false);
  });

  it("returns the earliest future start or end boundary", () => {
    const nowMs = Date.parse("2026-07-16T09:00:00.000Z");
    const slides = [
      createSlide({
        id: "future",
        startAt: "2026-07-16T09:10:00.000Z"
      }),
      createSlide({
        id: "ending",
        endAt: "2026-07-16T09:05:00.000Z"
      })
    ];

    expect(getNextCarouselScheduleBoundaryMs(slides, nowMs)).toBe(Date.parse("2026-07-16T09:05:00.000Z") + 1);
  });

  it("ignores disabled slides and slides without a desktop image", () => {
    const nowMs = Date.parse("2026-07-16T09:00:00.000Z");

    expect(
      getNextCarouselScheduleBoundaryMs(
        [
          createSlide({
            enabled: false,
            startAt: "2026-07-16T09:01:00.000Z"
          }),
          createSlide({
            id: "missing-image",
            imageUrl: "",
            startAt: "2026-07-16T09:02:00.000Z"
          })
        ],
        nowMs
      )
    ).toBeNull();
  });

  it("caps long browser timeouts and never returns a negative delay", () => {
    expect(getCarouselScheduleDelayMs(900, 1_000)).toBe(0);
    expect(getCarouselScheduleDelayMs(MAX_CAROUSEL_SCHEDULE_DELAY_MS + 10_000, 0)).toBe(MAX_CAROUSEL_SCHEDULE_DELAY_MS);
  });
});
