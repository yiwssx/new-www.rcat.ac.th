import { getGoogleAppsScriptUrl, projectSettings } from "../config/projectSettings";
import { DisplaySettings } from "../types";
import {
  getDisplaySettingsFromApi,
  saveDisplaySettingsToApi
} from "./googleApi";

export const defaultDisplaySettings: DisplaySettings = {
  dateFormat: "j F Y",
  timeMode: "24h"
};

export const dateFormatPresets = [
  { value: "j F Y", label: "27 เมษายน 2026 (j F Y)" },
  { value: "F j, Y", label: "เมษายน 27, 2026 (F j, Y)" },
  { value: "Y-m-d", label: "2026-04-27 (Y-m-d)" },
  { value: "m/d/Y", label: "04/27/2026 (m/d/Y)" },
  { value: "d/m/Y", label: "27/04/2026 (d/m/Y)" }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeDateFormat(value: unknown) {
  const nextValue = String(value || "").trim();

  if (!nextValue) {
    return defaultDisplaySettings.dateFormat;
  }

  if (nextValue.length > 80) {
    return defaultDisplaySettings.dateFormat;
  }

  if (/[^A-Za-z0-9 :/.,_\-\[\]\\]/.test(nextValue)) {
    return defaultDisplaySettings.dateFormat;
  }

  return nextValue;
}

function sanitizeTimeMode(value: unknown): DisplaySettings["timeMode"] {
  return value === "12h" ? "12h" : "24h";
}

export function normalizeDisplaySettings(input: unknown): DisplaySettings {
  if (!isRecord(input)) {
    return defaultDisplaySettings;
  }

  return {
    dateFormat: sanitizeDateFormat(input.dateFormat),
    timeMode: sanitizeTimeMode(input.timeMode)
  };
}

const displaySettingsStorageKey =
  projectSettings.storageKeys.displaySettings || "rcat.cms.display.settings";

function persistDisplaySettings(settings: DisplaySettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(displaySettingsStorageKey, JSON.stringify(settings));
}

function parseStoredDisplaySettings(): DisplaySettings | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(displaySettingsStorageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return normalizeDisplaySettings(parsed);
  } catch {
    return null;
  }
}

function usingBackendDisplaySettings() {
  return Boolean(getGoogleAppsScriptUrl());
}

export function getStoredDisplaySettings() {
  return parseStoredDisplaySettings() || defaultDisplaySettings;
}

export async function loadDisplaySettings(): Promise<DisplaySettings> {
  if (!usingBackendDisplaySettings()) {
    return getStoredDisplaySettings();
  }

  try {
    const settings = normalizeDisplaySettings(await getDisplaySettingsFromApi());
    persistDisplaySettings(settings);
    return settings;
  } catch {
    return getStoredDisplaySettings();
  }
}

export async function saveDisplaySettings(
  input: Partial<DisplaySettings>
): Promise<DisplaySettings> {
  const settings = normalizeDisplaySettings({
    ...getStoredDisplaySettings(),
    ...input
  });

  if (usingBackendDisplaySettings()) {
    const saved = normalizeDisplaySettings(await saveDisplaySettingsToApi(settings));
    persistDisplaySettings(saved);
    return saved;
  }

  persistDisplaySettings(settings);
  return settings;
}
