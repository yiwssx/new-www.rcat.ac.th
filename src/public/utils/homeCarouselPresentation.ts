import type { HomepageCarouselSettings } from "../../types";

export const PUBLIC_CAROUSEL_STAGE_HEIGHTS = {
  xs: "clamp(240px, 72vw, 300px)",
  sm: "clamp(300px, 44vw, 360px)",
  md: "clamp(360px, 30vw, 440px)",
  xl: 440
} as const;

export const PUBLIC_CAROUSEL_IMAGE_SIZES = "(max-width: 900px) 100vw, 1536px";

type CarouselControlSettings = Pick<HomepageCarouselSettings, "showArrows" | "showDots">;

export interface PublicCarouselControlVisibility {
  arrows: boolean;
  dots: boolean;
}

export function getPublicCarouselControlVisibility(
  settings: Partial<CarouselControlSettings> | undefined,
  visibleSlideCount: number
): PublicCarouselControlVisibility {
  const hasMultipleSlides = visibleSlideCount > 1;

  return {
    arrows: hasMultipleSlides && (settings?.showArrows ?? true),
    dots: hasMultipleSlides && (settings?.showDots ?? true)
  };
}
