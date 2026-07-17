import { describe, expect, it } from "vitest";
import type { CarouselSlide, HomepageCarouselSettings } from "../../types";
import {
  areHomepageCarouselSettingsEqual,
  getCarouselSlideValidationMessage,
  isCarouselBackgroundColorValid,
  normalizeCarouselAutoplayInterval
} from "./carousel";

const settings: HomepageCarouselSettings = {
  autoplayEnabled: true,
  autoplayIntervalSeconds: 5,
  showArrows: true,
  showDots: true,
  pauseOnHover: true,
  pauseOnFocus: true,
  transition: "slide"
};

const slide: CarouselSlide = {
  id: "slide-1",
  title: "Slide",
  subtitle: "",
  chip: "",
  imageUrl: "https://example.test/slide.jpg",
  imageAlt: "Slide",
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
  updatedAt: "2026-07-17T00:00:00.000Z"
};

describe("admin carousel utilities", () => {
  it("normalizes autoplay interval to the supported range", () => {
    expect(normalizeCarouselAutoplayInterval(1)).toBe(3);
    expect(normalizeCarouselAutoplayInterval(40)).toBe(30);
    expect(normalizeCarouselAutoplayInterval("8")).toBe(8);
    expect(normalizeCarouselAutoplayInterval(Number.NaN)).toBe(5);
  });

  it("compares every homepage carousel setting", () => {
    expect(areHomepageCarouselSettingsEqual(settings, { ...settings })).toBe(true);
    expect(
      areHomepageCarouselSettingsEqual(settings, {
        ...settings,
        pauseOnFocus: false
      })
    ).toBe(false);
    expect(
      areHomepageCarouselSettingsEqual(settings, {
        ...settings,
        transition: "fade"
      })
    ).toBe(false);
  });

  it("validates optional background colors", () => {
    expect(isCarouselBackgroundColorValid("")).toBe(true);
    expect(isCarouselBackgroundColorValid("#abc")).toBe(true);
    expect(isCarouselBackgroundColorValid("#A1B2C3")).toBe(true);
    expect(isCarouselBackgroundColorValid("green")).toBe(false);
  });

  it("rejects invalid background color and focal points before normalization", () => {
    expect(
      getCarouselSlideValidationMessage({
        ...slide,
        backgroundColor: "green"
      })
    ).toEqual({
      title: "สีพื้นหลังไม่ถูกต้อง",
      text: "กรุณาระบุสีในรูปแบบ #RGB หรือ #RRGGBB"
    });

    expect(
      getCarouselSlideValidationMessage({
        ...slide,
        focalPointX: 120
      })
    ).toEqual({
      title: "ตำแหน่งจุดโฟกัสไม่ถูกต้อง",
      text: "ค่าตำแหน่งแนวนอนและแนวตั้งต้องอยู่ระหว่าง 0 ถึง 100"
    });
  });
});
