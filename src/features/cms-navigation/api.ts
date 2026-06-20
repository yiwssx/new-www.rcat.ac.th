import { getAdminWriteProvider } from "../../config/adminWriteProvider";
import {
  getPublicMenuItems as getPublicMenuItemsFromAppsScript,
  savePublicMenuItems as savePublicMenuItemsFromAppsScript
} from "../../services/googleApi";
import { getPublicMenuItemsFromCloudflare, savePublicMenuItemsToCloudflare } from "../admin-write/cloudflareApi";
import type { PublicMenuItem } from "./types";

export function getPublicMenuItems() {
  return getAdminWriteProvider() === "cloudflare"
    ? getPublicMenuItemsFromCloudflare()
    : getPublicMenuItemsFromAppsScript();
}

export function savePublicMenuItems(items: PublicMenuItem[]) {
  return getAdminWriteProvider() === "cloudflare"
    ? savePublicMenuItemsToCloudflare(items)
    : savePublicMenuItemsFromAppsScript(items);
}
