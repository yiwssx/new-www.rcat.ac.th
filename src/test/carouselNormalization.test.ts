import { describe, expect, it } from "vitest";
import {
  normalizeCarouselBackgroundColor,
  normalizeCarouselFocalPoint,
  normalizeCarouselImageFit,
  normalizeCarouselSlide
} from "../features/cms-carousel";

describe("carousel normalization", () => {
  it("adds responsive defaults to legacy slides while preserving existing fields", () => {
    expect(
      normalizeCarouselSlide({
        id: "slide-1",
        title: " Title ",
        subtitle: " Sub ",
        chip: " Chip ",
        imageUrl: " https://example.edu/slide.jpg ",
        imageAlt: " Alt ",
        buttonLabel: " More ",
        href: " /news ",
        enabled: true,
        order: 2,
        startAt: "2026-07-01T00:00:00.000Z",
        endAt: "2026-07-31T00:00:00.000Z",
        updatedAt: "2026-07-13T00:00:00.000Z",
        revision: 3
      })
    ).toEqual({
      id: "slide-1",
      title: "Title",
      subtitle: "Sub",
      chip: "Chip",
      imageUrl: "https://example.edu/slide.jpg",
      imageAlt: "Alt",
      buttonLabel: "More",
      href: "/news",
      enabled: true,
      order: 2,
      startAt: "2026-07-01T00:00:00.000Z",
      endAt: "2026-07-31T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z",
      revision: 3,
      imageFit: "fit-blur",
      focalPointX: 50,
      focalPointY: 50,
      mobileImageUrl: "",
      backgroundColor: "",
      openInNewTab: false
    });
  });

  it("normalizes image fit", () => {
    expect(normalizeCarouselImageFit("fill")).toBe("fill");
    expect(normalizeCarouselImageFit("fit")).toBe("fit");
    expect(normalizeCarouselImageFit("fit-blur")).toBe("fit-blur");
    expect(normalizeCarouselImageFit("cover")).toBe("fit-blur");
  });

  it("normalizes focal points", () => {
    expect(normalizeCarouselFocalPoint(-10)).toBe(0);
    expect(normalizeCarouselFocalPoint(0)).toBe(0);
    expect(normalizeCarouselFocalPoint(25.5)).toBe(25.5);
    expect(normalizeCarouselFocalPoint(100)).toBe(100);
    expect(normalizeCarouselFocalPoint(140)).toBe(100);
    expect(normalizeCarouselFocalPoint("75")).toBe(75);
    expect(normalizeCarouselFocalPoint("abc")).toBe(50);
    expect(normalizeCarouselFocalPoint(Number.NaN)).toBe(50);
  });

  it("normalizes optional URL, color, and open target fields", () => {
    const slide = normalizeCarouselSlide({
      imageFit: "fill",
      focalPointX: "0" as never,
      focalPointY: "20" as never,
      mobileImageUrl: " https://example.edu/mobile.jpg ",
      backgroundColor: " #ABC ",
      openInNewTab: true
    });

    expect(slide.mobileImageUrl).toBe("https://example.edu/mobile.jpg");
    expect(slide.backgroundColor).toBe("#abc");
    expect(slide.openInNewTab).toBe(true);
    expect(normalizeCarouselBackgroundColor("")).toBe("");
    expect(normalizeCarouselBackgroundColor("#fff")).toBe("#fff");
    expect(normalizeCarouselBackgroundColor("#123456")).toBe("#123456");
    expect(normalizeCarouselBackgroundColor("expression(alert(1))")).toBe("");
    expect(normalizeCarouselSlide({ openInNewTab: "true" as never }).openInNewTab).toBe(false);
  });
});
