import { CarouselSlide } from "../../types";

export const CAROUSEL_FALLBACK_TITLE = "สไลด์ภาพ";

export function normalizeCarouselAutoplayInterval(value: string | number) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return 5;
  }

  return Math.min(30, Math.max(3, numericValue));
}

export function getCarouselSlideDisplayTitle(slide: CarouselSlide) {
  return slide.title.trim() || CAROUSEL_FALLBACK_TITLE;
}

export function getCarouselSlideValidationMessage(slide: CarouselSlide) {
  if (!slide.imageUrl.trim()) {
    return {
      title: "กรุณาระบุ URL รูปภาพ"
    };
  }

  const startAtMs = slide.startAt ? Date.parse(slide.startAt) : Number.NaN;
  const endAtMs = slide.endAt ? Date.parse(slide.endAt) : Number.NaN;

  if (Number.isFinite(startAtMs) && Number.isFinite(endAtMs) && endAtMs < startAtMs) {
    return {
      title: "ช่วงเวลาไม่ถูกต้อง",
      text: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น"
    };
  }

  return null;
}
