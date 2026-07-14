import type { CarouselImageFit, CarouselSlide } from "./types";

export const DEFAULT_CAROUSEL_IMAGE_FIT: CarouselImageFit = "fit-blur";
export const DEFAULT_CAROUSEL_FOCAL_POINT = 50;

const VALID_IMAGE_FITS = new Set<CarouselImageFit>(["fill", "fit", "fit-blur"]);

export function normalizeCarouselImageFit(value: unknown): CarouselImageFit {
  return typeof value === "string" && VALID_IMAGE_FITS.has(value as CarouselImageFit)
    ? (value as CarouselImageFit)
    : DEFAULT_CAROUSEL_IMAGE_FIT;
}

export function normalizeCarouselFocalPoint(value: unknown): number {
  const numericValue =
    typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_CAROUSEL_FOCAL_POINT;
  }

  return Math.min(100, Math.max(0, numericValue));
}

export function normalizeCarouselBackgroundColor(value: unknown): string {
  const color = typeof value === "string" ? value.trim().toLowerCase() : "";
  return color === "" || /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/.test(color) ? color : "";
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

export function normalizeCarouselSlide(input: Partial<CarouselSlide> | Record<string, unknown>): CarouselSlide {
  const source = input as Record<string, unknown>;
  const order = Number(source.order);
  const revision = Number(source.revision);

  return {
    id: normalizeString(source.id),
    title: normalizeString(source.title),
    subtitle: normalizeString(source.subtitle),
    chip: normalizeString(source.chip),
    imageUrl: normalizeString(source.imageUrl),
    imageAlt: normalizeString(source.imageAlt),
    buttonLabel: normalizeString(source.buttonLabel),
    href: normalizeString(source.href),
    enabled: source.enabled === true,
    order: Number.isFinite(order) ? order : 0,
    startAt: normalizeString(source.startAt),
    endAt: normalizeString(source.endAt),
    updatedAt: normalizeString(source.updatedAt),
    ...(Number.isInteger(revision) ? { revision } : {}),
    imageFit: normalizeCarouselImageFit(source.imageFit),
    focalPointX: normalizeCarouselFocalPoint(source.focalPointX),
    focalPointY: normalizeCarouselFocalPoint(source.focalPointY),
    mobileImageUrl: normalizeString(source.mobileImageUrl),
    backgroundColor: normalizeCarouselBackgroundColor(source.backgroundColor),
    openInNewTab: source.openInNewTab === true
  };
}
