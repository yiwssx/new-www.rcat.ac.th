import type { HomepageIntroGateSettings } from "../../types";

const DEFAULT_INTRO_GATE_STORAGE_KEY = "public-intro-gate";

export function shouldShowPublicIntroGate(settings?: HomepageIntroGateSettings) {
  return Boolean(settings?.enabled && settings.imageUrl.trim());
}

export function getPublicIntroGateStorageKey(settings?: HomepageIntroGateSettings) {
  return settings?.storageKey.trim() || DEFAULT_INTRO_GATE_STORAGE_KEY;
}

export function getInitialPublicIntroGateVisibility(settings?: HomepageIntroGateSettings) {
  return shouldShowPublicIntroGate(settings);
}

export function isPublicIntroGateDismissedInSession(settings?: HomepageIntroGateSettings) {
  if (!settings || typeof window === "undefined") {
    return false;
  }

  try {
    return window.sessionStorage.getItem(getPublicIntroGateStorageKey(settings)) === "dismissed";
  } catch {
    return false;
  }
}
