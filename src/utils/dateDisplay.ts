import dayjs from "dayjs";
import "dayjs/locale/th";
import buddhistEra from "dayjs/plugin/buddhistEra";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { DisplaySettings } from "../types";
import {
  defaultDisplaySettings,
  getStoredDisplaySettings,
  normalizeDateFormat,
  normalizeDisplaySettings
} from "../services/displaySettings";

const WORDPRESS_TO_DAYJS_MAP: Record<string, string> = {
  d: "DD",
  D: "ddd",
  j: "D",
  l: "dddd",
  F: "MMMM",
  m: "MM",
  M: "MMM",
  n: "M",
  Y: "BBBB",
  y: "BB",
  a: "a",
  A: "A",
  g: "h",
  G: "H",
  h: "hh",
  H: "HH",
  i: "mm",
  s: "ss"
};

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(buddhistEra);
dayjs.locale("th");

const THAI_TIME_ZONE = "Asia/Bangkok";

function escapeLiteral(value: string) {
  return value.replace(/\]/g, "\\]");
}

export function convertWordPressFormatToDayjs(format: string) {
  const rawFormat = String(format || "").trim();
  const source = /YYYY|MMMM|MM|DD/.test(rawFormat) ? normalizeDateFormat(rawFormat) : rawFormat || "j F Y";

  let result = "";
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (escaped) {
      result += `[${escapeLiteral(character)}]`;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    const mappedToken = WORDPRESS_TO_DAYJS_MAP[character];
    if (mappedToken) {
      result += mappedToken;
      continue;
    }

    if (/[A-Za-z]/.test(character)) {
      result += `[${escapeLiteral(character)}]`;
      continue;
    }

    result += character;
  }

  return result || "D MMMM YYYY";
}

function getTimeWordPressFormat(timeMode: DisplaySettings["timeMode"]) {
  void timeMode;
  return "H:i";
}

function resolveDisplaySettings(override?: Partial<DisplaySettings>) {
  return normalizeDisplaySettings({
    ...defaultDisplaySettings,
    ...getStoredDisplaySettings(),
    ...override
  });
}

function formatInThaiTimeZone(value: string | Date, wordpressFormat: string) {
  const parsed = dayjs(value);

  if (!parsed.isValid()) {
    return "";
  }

  return parsed.tz(THAI_TIME_ZONE).locale("th").format(convertWordPressFormatToDayjs(wordpressFormat));
}

export function formatDisplayDate(value: string | Date, settings?: Partial<DisplaySettings>) {
  const normalizedSettings = resolveDisplaySettings(settings);
  return formatInThaiTimeZone(value, normalizedSettings.dateFormat);
}

export function formatDisplayTime(value: string | Date, settings?: Partial<DisplaySettings>) {
  const normalizedSettings = resolveDisplaySettings(settings);
  return formatInThaiTimeZone(value, getTimeWordPressFormat(normalizedSettings.timeMode));
}

export function formatDisplayDateTime(value: string | Date, settings?: Partial<DisplaySettings>) {
  const normalizedSettings = resolveDisplaySettings(settings);
  return formatInThaiTimeZone(
    value,
    `${normalizedSettings.dateFormat} ${getTimeWordPressFormat(normalizedSettings.timeMode)}`
  );
}

export function formatDisplayDay(value: string | Date) {
  return formatInThaiTimeZone(value, "d");
}

export function formatDisplayMonthShort(value: string | Date) {
  return formatInThaiTimeZone(value, "M");
}

export function formatDisplayYear(value: string | Date) {
  return formatInThaiTimeZone(value, "Y");
}
