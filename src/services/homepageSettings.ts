import type { HomepageSettings } from "../types";

export const DEFAULT_HOMEPAGE_SETTINGS: HomepageSettings = {
  carousel: {
    autoplayEnabled: true,
    autoplayIntervalSeconds: 5
  },
  introGate: {
    enabled: false,
    imageUrl: "",
    imageAlt: "ภาพแนะนำ",
    primaryButtonLabel: "เข้าสู่เว็บไซต์หลัก",
    secondaryButtonLabel: "",
    secondaryButtonUrl: "",
    storageKey: "public-intro-gate"
  },
  marquee: {
    enabled: false,
    label: "ประชาสัมพันธ์",
    text: "",
    speedSeconds: 60
  },
  introVideo: {
    enabled: false,
    title: "วีดิทัศน์แนะนำสถานศึกษา",
    youtubeEmbedUrl: ""
  }
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeEnabled(value: unknown) {
  return value === true;
}

function normalizeSpeedSeconds(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_HOMEPAGE_SETTINGS.marquee.speedSeconds;
  }

  return Math.min(180, Math.max(24, numericValue));
}

function normalizeCarouselIntervalSeconds(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_HOMEPAGE_SETTINGS.carousel.autoplayIntervalSeconds;
  }

  return Math.min(30, Math.max(3, numericValue));
}

export function normalizeHomepageSettings(input?: Partial<HomepageSettings> | null): HomepageSettings {
  const source: Record<string, unknown> = isObjectRecord(input) ? input : {};
  const carousel: Record<string, unknown> = isObjectRecord(source.carousel) ? source.carousel : {};
  const introGate: Record<string, unknown> = isObjectRecord(source.introGate) ? source.introGate : {};
  const marquee: Record<string, unknown> = isObjectRecord(source.marquee) ? source.marquee : {};
  const introVideo: Record<string, unknown> = isObjectRecord(source.introVideo) ? source.introVideo : {};

  return {
    carousel: {
      autoplayEnabled:
        typeof carousel.autoplayEnabled === "boolean"
          ? carousel.autoplayEnabled
          : DEFAULT_HOMEPAGE_SETTINGS.carousel.autoplayEnabled,
      autoplayIntervalSeconds: normalizeCarouselIntervalSeconds(carousel.autoplayIntervalSeconds)
    },
    introGate: {
      enabled: normalizeEnabled(introGate.enabled),
      imageUrl: normalizeString(introGate.imageUrl, DEFAULT_HOMEPAGE_SETTINGS.introGate.imageUrl),
      imageAlt: normalizeString(introGate.imageAlt, DEFAULT_HOMEPAGE_SETTINGS.introGate.imageAlt),
      primaryButtonLabel: normalizeString(
        introGate.primaryButtonLabel,
        DEFAULT_HOMEPAGE_SETTINGS.introGate.primaryButtonLabel
      ),
      secondaryButtonLabel: normalizeString(
        introGate.secondaryButtonLabel,
        DEFAULT_HOMEPAGE_SETTINGS.introGate.secondaryButtonLabel
      ),
      secondaryButtonUrl: normalizeString(
        introGate.secondaryButtonUrl,
        DEFAULT_HOMEPAGE_SETTINGS.introGate.secondaryButtonUrl
      ),
      storageKey: normalizeString(introGate.storageKey, DEFAULT_HOMEPAGE_SETTINGS.introGate.storageKey)
    },
    marquee: {
      enabled: normalizeEnabled(marquee.enabled),
      label: normalizeString(marquee.label, DEFAULT_HOMEPAGE_SETTINGS.marquee.label),
      text: normalizeString(marquee.text, DEFAULT_HOMEPAGE_SETTINGS.marquee.text),
      speedSeconds: normalizeSpeedSeconds(marquee.speedSeconds)
    },
    introVideo: {
      enabled: normalizeEnabled(introVideo.enabled),
      title: normalizeString(introVideo.title, DEFAULT_HOMEPAGE_SETTINGS.introVideo.title),
      youtubeEmbedUrl: normalizeString(introVideo.youtubeEmbedUrl, DEFAULT_HOMEPAGE_SETTINGS.introVideo.youtubeEmbedUrl)
    }
  };
}
