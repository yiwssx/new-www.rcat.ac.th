import {
  getDisplaySettingsFromCloudflare,
  getHomepageSettingsFromCloudflare,
  getSiteSettingsFromCloudflare,
  saveDisplaySettingsToCloudflare,
  saveHomepageSettingsToCloudflare,
  saveSiteSettingsToCloudflare,
  saveVisitorStatsToCloudflare
} from "../admin-write/cloudflareApi";
import { prewarmPublicImageDeliveryVariants } from "../../shared/media/publicImageDeliveryWarmup";
import { resolvePublicImageSource } from "../../shared/media/publicImageSources";
import type { DisplaySettings, HomepageSettings, SiteSettings } from "./types";
import type { VisitorStatsSettings } from "../visitor-stats/types";

export function getDisplaySettingsFromApi() {
  return getDisplaySettingsFromCloudflare();
}

export function getSiteSettingsFromApi() {
  return getSiteSettingsFromCloudflare();
}

export function getHomepageSettingsFromApi() {
  return getHomepageSettingsFromCloudflare();
}

export function saveDisplaySettingsToApi(settings: Partial<DisplaySettings>) {
  return saveDisplaySettingsToCloudflare(settings);
}

export async function saveSiteSettingsToApi(settings: Partial<SiteSettings>) {
  if (settings.directorImageUrl) {
    await prewarmPublicImageDeliveryVariants(settings.directorImageUrl, "portrait");
  }

  return saveSiteSettingsToCloudflare(settings);
}

export async function saveHomepageSettingsToApi(settings: Partial<HomepageSettings>) {
  if (settings.introGate?.enabled) {
    const introImage = resolvePublicImageSource(settings.introGate.imageUrl, "intro-gate");

    if (!introImage.src) {
      throw new Error("IntroGate ที่เปิดใช้งานต้องมีภาพประชาสัมพันธ์ที่ระบบสามารถแสดงได้");
    }

    await prewarmPublicImageDeliveryVariants(settings.introGate.imageUrl, "intro-gate");
  }

  return saveHomepageSettingsToCloudflare(settings);
}

export function saveVisitorStatsToApi(stats: Partial<VisitorStatsSettings>) {
  return saveVisitorStatsToCloudflare(stats);
}
