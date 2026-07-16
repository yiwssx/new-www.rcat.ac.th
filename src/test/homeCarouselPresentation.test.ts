import { describe, expect, it } from "vitest";
import {
  getPublicCarouselControlVisibility,
  PUBLIC_CAROUSEL_IMAGE_SIZES,
  PUBLIC_CAROUSEL_STAGE_HEIGHTS
} from "../public/utils/homeCarouselPresentation";

describe("public home carousel presentation", () => {
  it("defines a fixed responsive stage height contract", () => {
    expect(PUBLIC_CAROUSEL_STAGE_HEIGHTS).toEqual({
      xs: "clamp(240px, 72vw, 300px)",
      sm: "clamp(300px, 44vw, 360px)",
      md: "clamp(360px, 30vw, 440px)",
      xl: 440
    });
    expect(PUBLIC_CAROUSEL_IMAGE_SIZES).toBe("(max-width: 900px) 100vw, 1536px");
  });

  it("shows both control groups by default only when multiple slides are visible", () => {
    expect(getPublicCarouselControlVisibility(undefined, 0)).toEqual({
      arrows: false,
      dots: false
    });
    expect(getPublicCarouselControlVisibility(undefined, 1)).toEqual({
      arrows: false,
      dots: false
    });
    expect(getPublicCarouselControlVisibility(undefined, 2)).toEqual({
      arrows: true,
      dots: true
    });
  });

  it("preserves explicit false values independently", () => {
    expect(getPublicCarouselControlVisibility({ showArrows: false, showDots: true }, 3)).toEqual({
      arrows: false,
      dots: true
    });
    expect(getPublicCarouselControlVisibility({ showArrows: true, showDots: false }, 3)).toEqual({
      arrows: true,
      dots: false
    });
    expect(getPublicCarouselControlVisibility({ showArrows: false, showDots: false }, 3)).toEqual({
      arrows: false,
      dots: false
    });
  });
});
