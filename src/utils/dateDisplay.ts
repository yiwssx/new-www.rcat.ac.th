import dayjs from "dayjs";
import "dayjs/locale/th";
import { DisplaySettings } from "../types";
import {
  defaultDisplaySettings,
  getStoredDisplaySettings
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
  Y: "YYYY",
  y: "YY",
  a: "a",
  A: "A",
  g: "h",
  G: "H",
  h: "hh",
  H: "HH",
  i: "mm",
  s: "ss"
};

dayjs.locale("th");

function escapeLiteral(value: string) {
  return value.replace(/\]/g, "\\]");
}

export function convertWordPressFormatToDayjs(format: string) {
  const source = String(format || "").trim();
  if (!source) {
    return "D MMMM YYYY";
  }

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
  return timeMode === "12h" ? "g:i a" : "H:i";
}

function resolveDisplaySettings(override?: Partial<DisplaySettings>) {
  return {
    ...defaultDisplaySettings,
    ...getStoredDisplaySettings(),
    ...override
  };
}

export function formatDisplayDate(value: string | Date, settings?: Partial<DisplaySettings>) {
  const normalizedSettings = resolveDisplaySettings(settings);
  return dayjs(value).locale("th").format(convertWordPressFormatToDayjs(normalizedSettings.dateFormat));
}

export function formatDisplayTime(value: string | Date, settings?: Partial<DisplaySettings>) {
  const normalizedSettings = resolveDisplaySettings(settings);
  return dayjs(value).locale("th").format(
    convertWordPressFormatToDayjs(getTimeWordPressFormat(normalizedSettings.timeMode))
  );
}

export function formatDisplayDateTime(value: string | Date, settings?: Partial<DisplaySettings>) {
  const normalizedSettings = resolveDisplaySettings(settings);
  return dayjs(value).locale("th").format(
    `${convertWordPressFormatToDayjs(normalizedSettings.dateFormat)} ${convertWordPressFormatToDayjs(
      getTimeWordPressFormat(normalizedSettings.timeMode)
    )}`
  );
}
