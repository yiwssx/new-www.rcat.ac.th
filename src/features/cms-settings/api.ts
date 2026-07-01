import {
  getDisplaySettingsFromCloudflare,
  saveDisplaySettingsToCloudflare,
  saveHomepageSettingsToCloudflare,
  saveSiteSettingsToCloudflare,
  saveVisitorStatsToCloudflare
} from "../admin-write/cloudflareApi";
import type { DisplaySettings, HomepageSettings, SiteSettings } from "./types";
import type { VisitorStatsSettings } from "../visitor-stats/types";

export function getDisplaySettingsFromApi() {
  return getDisplaySettingsFromCloudflare();
}

export function saveDisplaySettingsToApi(settings: Partial<DisplaySettings>) {
  return saveDisplaySettingsToCloudflare(settings);
}

export function saveSiteSettingsToApi(settings: Partial<SiteSettings>) {
  return saveSiteSettingsToCloudflare(settings);
}

export function saveHomepageSettingsToApi(settings: Partial<HomepageSettings>) {
  return saveHomepageSettingsToCloudflare(settings);
}

export function saveVisitorStatsToApi(stats: Partial<VisitorStatsSettings>) {
  return saveVisitorStatsToCloudflare(stats);
}
