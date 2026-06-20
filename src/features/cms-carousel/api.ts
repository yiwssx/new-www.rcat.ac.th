import { getAdminWriteProvider } from "../../config/adminWriteProvider";
import {
  deleteCarouselSlideFromApi as deleteCarouselSlideFromAppsScript,
  saveCarouselSlideToApi as saveCarouselSlideToAppsScript
} from "../../services/googleApi";
import { deleteCarouselSlideFromCloudflare, saveCarouselSlideToCloudflare } from "../admin-write/cloudflareApi";
export type { CarouselSlideInput } from "../../services/googleApi";
import type { CarouselSlideInput } from "../../services/googleApi";

export function saveCarouselSlideToApi(input: CarouselSlideInput) {
  return getAdminWriteProvider() === "cloudflare"
    ? saveCarouselSlideToCloudflare(input)
    : saveCarouselSlideToAppsScript(input);
}

export function deleteCarouselSlideFromApi(id: string) {
  return getAdminWriteProvider() === "cloudflare"
    ? deleteCarouselSlideFromCloudflare(id)
    : deleteCarouselSlideFromAppsScript(id);
}
