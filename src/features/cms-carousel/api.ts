import { deleteCarouselSlideFromCloudflare, saveCarouselSlideToCloudflare } from "../admin-write/cloudflareApi";
import { prewarmPublicImageDeliveryVariants } from "../../shared/media/publicImageDeliveryWarmup";
import type { CarouselSlideInput } from "./types";
export type { CarouselSlideInput } from "./types";

export async function saveCarouselSlideToApi(input: CarouselSlideInput) {
  const sources = [input.imageUrl, input.mobileImageUrl].filter(
    (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index
  );

  await Promise.all(sources.map((source) => prewarmPublicImageDeliveryVariants(source, "carousel")));

  return saveCarouselSlideToCloudflare(input);
}

export function deleteCarouselSlideFromApi(id: string) {
  return deleteCarouselSlideFromCloudflare(id);
}
