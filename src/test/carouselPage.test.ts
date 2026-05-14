import { describe, expect, it } from "vitest";
import { getCarouselSlideValidationMessage } from "../admin/utils/carousel";
import { CarouselSlide } from "../types";

function createSlide(overrides: Partial<CarouselSlide> = {}): CarouselSlide {
  return {
    id: "carousel-1",
    title: "",
    subtitle: "",
    chip: "",
    imageUrl: "https://example.edu/ceremony.jpg",
    imageAlt: "",
    buttonLabel: "",
    href: "",
    enabled: true,
    order: 1,
    startAt: "",
    endAt: "",
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides
  };
}

describe("CarouselPage validation", () => {
  it("allows saving a carousel slide with imageUrl and no title", () => {
    expect(getCarouselSlideValidationMessage(createSlide({ title: "" }))).toBeNull();
  });

  it("still requires imageUrl for carousel slides", () => {
    expect(getCarouselSlideValidationMessage(createSlide({ imageUrl: "" }))).toMatchObject({
      title: "กรุณาระบุ URL รูปภาพ"
    });
  });
});
