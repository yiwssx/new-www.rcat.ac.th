import { deleteCarouselSlideFromCloudflare, saveCarouselSlideToCloudflare } from "../admin-write/cloudflareApi";
import type { CarouselSlideInput } from "./types";
export type { CarouselSlideInput } from "./types";

export function saveCarouselSlideToApi(input: CarouselSlideInput) {
  return saveCarouselSlideToCloudflare(input);
}

export function deleteCarouselSlideFromApi(id: string) {
  return deleteCarouselSlideFromCloudflare(id);
}
