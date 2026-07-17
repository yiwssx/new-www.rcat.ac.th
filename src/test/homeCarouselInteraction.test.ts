import { describe, expect, it } from "vitest";
import {
  getLoopedCarouselIndex,
  normalizePublicCarouselTransition,
  shouldRunCarouselAutoplay
} from "../public/utils/homeCarouselInteraction";

const runnableConditions = {
  autoplayEnabled: true,
  slideCount: 2,
  userPaused: false,
  hovering: false,
  pauseOnHover: true,
  focusWithin: false,
  pauseOnFocus: true,
  documentVisible: true,
  prefersReducedMotion: false
};

describe("home carousel interaction", () => {
  it("normalizes transition values", () => {
    expect(normalizePublicCarouselTransition("fade")).toBe("fade");
    expect(normalizePublicCarouselTransition("slide")).toBe("slide");
    expect(normalizePublicCarouselTransition("invalid")).toBe("slide");
    expect(normalizePublicCarouselTransition(undefined)).toBe("slide");
  });

  it("starts autoplay only when every runtime condition allows it", () => {
    expect(shouldRunCarouselAutoplay(runnableConditions)).toBe(true);
    expect(shouldRunCarouselAutoplay({ ...runnableConditions, autoplayEnabled: false })).toBe(false);
    expect(shouldRunCarouselAutoplay({ ...runnableConditions, slideCount: 1 })).toBe(false);
    expect(shouldRunCarouselAutoplay({ ...runnableConditions, userPaused: true })).toBe(false);
    expect(shouldRunCarouselAutoplay({ ...runnableConditions, documentVisible: false })).toBe(false);
    expect(shouldRunCarouselAutoplay({ ...runnableConditions, prefersReducedMotion: true })).toBe(false);
  });

  it("respects pause-on-hover without forcing hover pause when disabled", () => {
    expect(shouldRunCarouselAutoplay({ ...runnableConditions, hovering: true })).toBe(false);
    expect(
      shouldRunCarouselAutoplay({
        ...runnableConditions,
        hovering: true,
        pauseOnHover: false
      })
    ).toBe(true);
  });

  it("respects pause-on-focus without forcing focus pause when disabled", () => {
    expect(shouldRunCarouselAutoplay({ ...runnableConditions, focusWithin: true })).toBe(false);
    expect(
      shouldRunCarouselAutoplay({
        ...runnableConditions,
        focusWithin: true,
        pauseOnFocus: false
      })
    ).toBe(true);
  });

  it("normalizes positive and negative carousel indexes", () => {
    expect(getLoopedCarouselIndex(0, 3)).toBe(0);
    expect(getLoopedCarouselIndex(3, 3)).toBe(0);
    expect(getLoopedCarouselIndex(4, 3)).toBe(1);
    expect(getLoopedCarouselIndex(-1, 3)).toBe(2);
    expect(getLoopedCarouselIndex(-4, 3)).toBe(2);
    expect(getLoopedCarouselIndex(10, 0)).toBe(0);
  });
});
