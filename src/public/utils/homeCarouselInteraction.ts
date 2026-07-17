export type PublicCarouselTransition = "slide" | "fade";

export interface CarouselAutoplayConditions {
  autoplayEnabled: boolean;
  slideCount: number;
  userPaused: boolean;
  hovering: boolean;
  pauseOnHover: boolean;
  focusWithin: boolean;
  pauseOnFocus: boolean;
  documentVisible: boolean;
  prefersReducedMotion: boolean;
}

export function normalizePublicCarouselTransition(value: unknown): PublicCarouselTransition {
  return value === "fade" ? "fade" : "slide";
}

export function shouldRunCarouselAutoplay({
  autoplayEnabled,
  slideCount,
  userPaused,
  hovering,
  pauseOnHover,
  focusWithin,
  pauseOnFocus,
  documentVisible,
  prefersReducedMotion
}: CarouselAutoplayConditions) {
  if (!autoplayEnabled || slideCount <= 1 || userPaused || !documentVisible || prefersReducedMotion) {
    return false;
  }

  if (pauseOnHover && hovering) {
    return false;
  }

  if (pauseOnFocus && focusWithin) {
    return false;
  }

  return true;
}

export function getLoopedCarouselIndex(index: number, slideCount: number) {
  if (slideCount <= 0) {
    return 0;
  }

  return ((index % slideCount) + slideCount) % slideCount;
}
