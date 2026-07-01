import { getPublicMenuItemsFromCloudflare, savePublicMenuItemsToCloudflare } from "../admin-write/cloudflareApi";
import type { PublicMenuItem } from "./types";

export function getPublicMenuItems() {
  return getPublicMenuItemsFromCloudflare();
}

export function savePublicMenuItems(items: PublicMenuItem[]) {
  return savePublicMenuItemsToCloudflare(items);
}
