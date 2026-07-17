import type { CarouselSlide, HomepageCarouselSettings } from "../../types";

export const CAROUSEL_FALLBACK_TITLE = "สไลด์ภาพ";

const CAROUSEL_BACKGROUND_COLOR_PATTERN = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;

export function normalizeCarouselAutoplayInterval(value: string | number) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return 5;
  }

  return Math.min(30, Math.max(3, numericValue));
}

export function areHomepageCarouselSettingsEqual(left: HomepageCarouselSettings, right: HomepageCarouselSettings) {
  return (
    left.autoplayEnabled === right.autoplayEnabled &&
    left.autoplayIntervalSeconds === right.autoplayIntervalSeconds &&
    left.showArrows === right.showArrows &&
    left.showDots === right.showDots &&
    left.pauseOnHover === right.pauseOnHover &&
    left.pauseOnFocus === right.pauseOnFocus &&
    left.transition === right.transition
  );
}

export function isCarouselBackgroundColorValid(value: string) {
  const normalizedValue = value.trim();
  return normalizedValue === "" || CAROUSEL_BACKGROUND_COLOR_PATTERN.test(normalizedValue);
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

  if (!isCarouselBackgroundColorValid(slide.backgroundColor)) {
    return {
      title: "สีพื้นหลังไม่ถูกต้อง",
      text: "กรุณาระบุสีในรูปแบบ #RGB หรือ #RRGGBB"
    };
  }

  if (
    !Number.isFinite(slide.focalPointX) ||
    !Number.isFinite(slide.focalPointY) ||
    slide.focalPointX < 0 ||
    slide.focalPointX > 100 ||
    slide.focalPointY < 0 ||
    slide.focalPointY > 100
  ) {
    return {
      title: "ตำแหน่งจุดโฟกัสไม่ถูกต้อง",
      text: "ค่าตำแหน่งแนวนอนและแนวตั้งต้องอยู่ระหว่าง 0 ถึง 100"
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
