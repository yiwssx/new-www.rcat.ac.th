import { beforeEach, describe, expect, it } from "vitest";
import { projectSettings } from "../config/projectSettings";
import {
  defaultDisplaySettings,
  getStoredDisplaySettings,
  normalizeDateFormat,
  normalizeDisplaySettings
} from "../services/displaySettings";
import { convertWordPressFormatToDayjs, formatDisplayDateTime } from "./dateDisplay";

const bangkokDate = "2026-06-05T10:50:00+07:00";

beforeEach(() => {
  window.localStorage.clear();
});

describe("Thai display date normalization", () => {
  it("formats WordPress date tokens once in Bangkok time with a 24-hour clock", () => {
    expect(convertWordPressFormatToDayjs("j F Y")).toBe("D MMMM YYYY");
    expect(formatDisplayDateTime(bangkokDate, { dateFormat: "j F Y", timeMode: "24h" })).toBe("5 มิถุนายน 2026 10:50");
  });

  it("accepts an existing dayjs date format without duplicating month or year tokens", () => {
    expect(normalizeDateFormat("D MMMM YYYY")).toBe("j F Y");
    const formatted = formatDisplayDateTime(bangkokDate, { dateFormat: "D MMMM YYYY", timeMode: "24h" });

    expect(formatted).toBe("5 มิถุนายน 2026 10:50");
    expect(formatted.match(/มิถุนายน/g)).toHaveLength(1);
    expect(formatted).not.toContain("20262026");
  });

  it.each(["D MMMM MMMM YYYY YYYY", "YYYYYYYY-MM-DD", "j F Y j F Y", "not-a-date-format"])(
    "falls back safely for corrupted format %s",
    (dateFormat) => {
      expect(normalizeDisplaySettings({ dateFormat, timeMode: "12h" })).toEqual(defaultDisplaySettings);
      expect(formatDisplayDateTime(bangkokDate, { dateFormat, timeMode: "12h" })).toBe("5 มิถุนายน 2026 10:50");
    }
  );

  it("repairs stale stored display settings when they are read", () => {
    const storageKey = projectSettings.storageKeys.displaySettings;
    window.localStorage.setItem(storageKey, JSON.stringify({ dateFormat: "D MMMM MMMM YYYY YYYY", timeMode: "12h" }));

    expect(getStoredDisplaySettings()).toEqual(defaultDisplaySettings);
    expect(JSON.parse(window.localStorage.getItem(storageKey) || "{}")).toEqual(defaultDisplaySettings);
  });
});
