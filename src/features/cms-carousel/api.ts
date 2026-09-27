import { deleteCarouselSlideFromCloudflare, saveCarouselSlideToCloudflare } from "../admin-write/cloudflareApi";
import { prewarmPublicImageDeliveryVariants } from "../../shared/media/publicImageDeliveryWarmup";
import { isPublicImageDeliveryEnabled } from "../../shared/media/publicImageSources";
import type { CarouselSlideInput } from "./types";
export type { CarouselSlideInput } from "./types";

export function saveCarouselSlideToApi(input: CarouselSlideInput) {
  if (isPublicImageDeliveryEnabled("carousel")) {
    const sources = [input.imageUrl, input.mobileImageUrl].filter(
      (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index
    );

    void Promise.all(sources.map((source) => prewarmPublicImageDeliveryVariants(source, "carousel")));
  }

  return saveCarouselSlideToCloudflare(input);
}

export function deleteCarouselSlideFromApi(id: string) {
  return deleteCarouselSlideFromCloudflare(id);
}
