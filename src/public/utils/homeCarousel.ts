import { CarouselSlide } from "../../types";

const DEFAULT_AUTOPLAY_INTERVAL_SECONDS = 5;

export const MAX_CAROUSEL_SCHEDULE_DELAY_MS = 2_147_000_000;

function parseCarouselDateTime(value: string | undefined) {
  if (!value) {
    return Number.NaN;
  }

  return Date.parse(value);
}

export function isCarouselSlideActive(slide: CarouselSlide, nowMs: number) {
  if (!slide.enabled || !slide.imageUrl) {
    return false;
  }

  const startTime = parseCarouselDateTime(slide.startAt);
  const endTime = parseCarouselDateTime(slide.endAt);

  if (Number.isFinite(startTime) && startTime > nowMs) {
    return false;
  }

  if (Number.isFinite(endTime) && endTime < nowMs) {
    return false;
  }

  return true;
}

export function getNextCarouselScheduleBoundaryMs(slides: CarouselSlide[], nowMs: number) {
  let nextBoundaryMs = Number.POSITIVE_INFINITY;

  slides.forEach((slide) => {
    if (!slide.enabled || !slide.imageUrl) {
      return;
    }

    const startTime = parseCarouselDateTime(slide.startAt);
    const endTime = parseCarouselDateTime(slide.endAt);

    if (Number.isFinite(startTime) && startTime > nowMs) {
      nextBoundaryMs = Math.min(nextBoundaryMs, startTime);
    }

    if (Number.isFinite(endTime) && endTime >= nowMs) {
      nextBoundaryMs = Math.min(nextBoundaryMs, endTime + 1);
    }
  });

  return Number.isFinite(nextBoundaryMs) ? nextBoundaryMs : null;
}

export function getCarouselScheduleDelayMs(nextBoundaryMs: number, nowMs: number) {
  const requestedDelayMs = Math.max(0, nextBoundaryMs - nowMs);

  return Math.min(requestedDelayMs, MAX_CAROUSEL_SCHEDULE_DELAY_MS);
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
