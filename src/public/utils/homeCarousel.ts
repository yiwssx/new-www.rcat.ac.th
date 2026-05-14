import { CarouselSlide } from "../../types";

const DEFAULT_AUTOPLAY_INTERVAL_SECONDS = 5;

export function isCarouselSlideActive(slide: CarouselSlide, nowMs: number) {
  if (!slide.enabled || !slide.imageUrl) {
    return false;
  }

  const startTime = slide.startAt ? Date.parse(slide.startAt) : Number.NaN;
  const endTime = slide.endAt ? Date.parse(slide.endAt) : Number.NaN;

  if (Number.isFinite(startTime) && startTime > nowMs) {
    return false;
  }

  if (Number.isFinite(endTime) && endTime < nowMs) {
    return false;
  }

  return true;
}

export function normalizeCarouselAutoplayIntervalSeconds(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_AUTOPLAY_INTERVAL_SECONDS;
  }

  return Math.min(30, Math.max(3, numericValue));
}

export function shouldStartCarouselAutoplay(enabled: boolean, slideCount: number) {
  return enabled && slideCount > 1;
}
