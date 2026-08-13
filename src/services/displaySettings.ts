import { projectSettings } from "../config/projectSettings";
import type { DisplaySettings } from "../types";

export const defaultDisplaySettings: DisplaySettings = {
  dateFormat: "j F Y",
  timeMode: "24h"
};

export const dateFormatPresets = [
  { value: "j F Y", label: "27 เมษายน 2569 (j F Y)" },
  { value: "F j, Y", label: "เมษายน 27, 2569 (F j, Y)" },
  { value: "Y-m-d", label: "2569-04-27 (Y-m-d)" },
  { value: "m/d/Y", label: "04/27/2569 (m/d/Y)" },
  { value: "d/m/Y", label: "27/04/2569 (d/m/Y)" }
];

const canonicalDateFormats = new Set(dateFormatPresets.map((preset) => preset.value));
const dayjsToWordPressDateFormats = new Map([
  ["D MMMM YYYY", "j F Y"],
  ["MMMM D, YYYY", "F j, Y"],
  ["YYYY-MM-DD", "Y-m-d"],
  ["MM/DD/YYYY", "m/d/Y"],
  ["DD/MM/YYYY", "d/m/Y"]
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeDateFormat(value: unknown) {
  const nextValue = String(value || "").trim();
  const convertedDayjsFormat = dayjsToWordPressDateFormats.get(nextValue);

  if (convertedDayjsFormat) {
    return convertedDayjsFormat;
  }

  return canonicalDateFormats.has(nextValue) ? nextValue : defaultDisplaySettings.dateFormat;
}

export function normalizeDisplaySettings(input: unknown): DisplaySettings {
  if (!isRecord(input)) {
    return defaultDisplaySettings;
  }

  return {
    dateFormat: normalizeDateFormat(input.dateFormat),
    timeMode: "24h"
  };
}

const displaySettingsStorageKey = projectSettings.storageKeys.displaySettings || "rcat.cms.display.settings";

function getDisplaySettingsStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function persistDisplaySettings(settings: DisplaySettings) {
  try {
    getDisplaySettingsStorage()?.setItem(displaySettingsStorageKey, JSON.stringify(settings));
  } catch {
    // Display settings are a local presentation cache; API data remains authoritative.
  }
}

function parseStoredDisplaySettings(): DisplaySettings | null {
  const storage = getDisplaySettingsStorage();

  if (!storage) {
    return null;
  }

  let raw: string;

  try {
    raw = storage.getItem(displaySettingsStorageKey) || "";
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeDisplaySettings(parsed);
    if (raw !== JSON.stringify(normalized)) {
      persistDisplaySettings(normalized);
    }
    return normalized;
  } catch {
    return null;
  }
}

export function getStoredDisplaySettings() {
  return parseStoredDisplaySettings() || defaultDisplaySettings;
}

export async function loadDisplaySettings(): Promise<DisplaySettings> {
  try {
    const { getDisplaySettingsFromApi } = await import("../features/cms-settings/api");
    const settings = normalizeDisplaySettings(await getDisplaySettingsFromApi());
    persistDisplaySettings(settings);
    return settings;
  } catch {
    return getStoredDisplaySettings();
  }
}

export async function saveDisplaySettings(input: Partial<DisplaySettings>): Promise<DisplaySettings> {
  const { saveDisplaySettingsToApi } = await import("../features/cms-settings/api");
  const settings = normalizeDisplaySettings({
    ...getStoredDisplaySettings(),
    ...input
  });

  const saved = normalizeDisplaySettings(await saveDisplaySettingsToApi(settings));
  persistDisplaySettings(saved);
  return saved;
}
