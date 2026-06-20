import { getAdminWriteProvider } from "../../config/adminWriteProvider";
import {
  getDisplaySettingsFromApi as getDisplaySettingsFromAppsScript,
  saveDisplaySettingsToApi as saveDisplaySettingsToAppsScript,
  saveHomepageSettingsToApi as saveHomepageSettingsToAppsScript,
  saveSiteSettingsToApi as saveSiteSettingsToAppsScript
} from "../../services/googleApi";
import { saveVisitorStatsToApi } from "../../services/googleApi";
import {
  getDisplaySettingsFromCloudflare,
  saveDisplaySettingsToCloudflare,
  saveHomepageSettingsToCloudflare,
  saveSiteSettingsToCloudflare
} from "../admin-write/cloudflareApi";
import type { DisplaySettings, HomepageSettings, SiteSettings } from "./types";

export function getDisplaySettingsFromApi() {
  return getAdminWriteProvider() === "cloudflare"
    ? getDisplaySettingsFromCloudflare()
    : getDisplaySettingsFromAppsScript();
}

export function saveDisplaySettingsToApi(settings: Partial<DisplaySettings>) {
  return getAdminWriteProvider() === "cloudflare"
    ? saveDisplaySettingsToCloudflare(settings)
    : saveDisplaySettingsToAppsScript(settings);
}

export function saveSiteSettingsToApi(settings: Partial<SiteSettings>) {
  return getAdminWriteProvider() === "cloudflare"
    ? saveSiteSettingsToCloudflare(settings)
    : saveSiteSettingsToAppsScript(settings);
}

export function saveHomepageSettingsToApi(settings: Partial<HomepageSettings>) {
  return getAdminWriteProvider() === "cloudflare"
    ? saveHomepageSettingsToCloudflare(settings)
    : saveHomepageSettingsToAppsScript(settings);
}

export { saveVisitorStatsToApi };
