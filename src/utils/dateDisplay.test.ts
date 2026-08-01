import { beforeEach, describe, expect, it } from "vitest";
import { projectSettings } from "../config/projectSettings";
import {
  dateFormatPresets,
  defaultDisplaySettings,
  getStoredDisplaySettings,
  normalizeDateFormat,
  normalizeDisplaySettings
} from "../services/displaySettings";
import {
  convertWordPressFormatToDayjs,
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayDay,
  formatDisplayMonthShort,
  formatDisplayTime,
  formatDisplayYear
} from "./dateDisplay";

const bangkokDate = "2026-06-05T10:50:00+07:00";
const bangkokBoundaryUtc = "2026-07-31T17:30:00.000Z";

beforeEach(() => {
  window.localStorage.clear();
});

describe("Thai display date normalization", () => {
  it("converts WordPress year tokens to Buddhist Era tokens without changing escaped literals", () => {
    expect(convertWordPressFormatToDayjs("j F Y")).toBe("D MMMM BBBB");
    expect(convertWordPressFormatToDayjs("Y-m-d")).toBe("BBBB-MM-DD");
    expect(convertWordPressFormatToDayjs("y")).toBe("BB");
    expect(convertWordPressFormatToDayjs("Y \\Y")).toBe("BBBB [Y]");
    expect(convertWordPressFormatToDayjs("j F Y \\a\\t H:i")).toBe("D MMMM BBBB [a][t] HH:mm");
  });

  it("formats WordPress date tokens once in Bangkok time with a Buddhist year and 24-hour clock", () => {
    expect(formatDisplayDateTime(bangkokDate, { dateFormat: "j F Y", timeMode: "24h" })).toBe("5 มิถุนายน 2569 10:50");
  });

  it("accepts an existing dayjs date format without duplicating month or year tokens", () => {
    expect(normalizeDateFormat("D MMMM YYYY")).toBe("j F Y");
    const formatted = formatDisplayDateTime(bangkokDate, { dateFormat: "D MMMM YYYY", timeMode: "24h" });

    expect(formatted).toBe("5 มิถุนายน 2569 10:50");
    expect(formatted.match(/มิถุนายน/g)).toHaveLength(1);
    expect(formatted).not.toContain("25692569");
  });

  it.each([
    ["j F Y", "27 เมษายน 2569"],
    ["F j, Y", "เมษายน 27, 2569"],
    ["Y-m-d", "2569-04-27"],
    ["m/d/Y", "04/27/2569"],
    ["d/m/Y", "27/04/2569"]
  ])("renders configured date format %s with a Buddhist year", (dateFormat, expected) => {
    expect(formatDisplayDate("2026-04-27T12:00:00+07:00", { dateFormat })).toBe(expected);
  });

  it("uses Bangkok for UTC and offset-bearing timestamps at a date boundary", () => {
    const bangkokBoundaryOffset = "2026-08-01T00:30:00+07:00";

    expect(formatDisplayDate(bangkokBoundaryUtc)).toBe("1 สิงหาคม 2569");
    expect(formatDisplayTime(bangkokBoundaryUtc)).toBe("00:30");
    expect(formatDisplayDateTime(bangkokBoundaryUtc)).toBe("1 สิงหาคม 2569 00:30");
    expect(formatDisplayDateTime(bangkokBoundaryOffset)).toBe("1 สิงหาคม 2569 00:30");
    expect(formatDisplayDay(bangkokBoundaryUtc)).toBe("01");
    expect(formatDisplayMonthShort(bangkokBoundaryUtc)).toBe("ส.ค.");
    expect(formatDisplayYear(bangkokBoundaryUtc)).toBe("2569");
  });

  it("preserves midnight, shortly before midnight, and the Bangkok year boundary", () => {
    expect(formatDisplayDateTime("2026-08-01T17:00:00.000Z")).toBe("2 สิงหาคม 2569 00:00");
    expect(formatDisplayDateTime("2026-08-01T16:59:59.999Z")).toBe("1 สิงหาคม 2569 23:59");
    expect(formatDisplayYear("2026-12-31T16:59:59.999Z")).toBe("2569");
    expect(formatDisplayYear("2026-12-31T17:00:00.000Z")).toBe("2570");
  });

  it("always uses a 24-hour clock even when stale settings request 12-hour time", () => {
    expect(formatDisplayTime("2026-08-01T14:30:00+07:00", { timeMode: "12h" })).toBe("14:30");
  });

  it("returns an empty string for invalid presentation values", () => {
    expect(formatDisplayDate("not-a-date")).toBe("");
    expect(formatDisplayTime("not-a-date")).toBe("");
    expect(formatDisplayDateTime("not-a-date")).toBe("");
    expect(formatDisplayDay("not-a-date")).toBe("");
    expect(formatDisplayMonthShort("not-a-date")).toBe("");
    expect(formatDisplayYear("not-a-date")).toBe("");
  });

  it.each(["D MMMM MMMM YYYY YYYY", "YYYYYYYY-MM-DD", "j F Y j F Y", "not-a-date-format"])(
    "falls back safely for corrupted format %s",
    (dateFormat) => {
      expect(normalizeDisplaySettings({ dateFormat, timeMode: "12h" })).toEqual(defaultDisplaySettings);
      expect(formatDisplayDateTime(bangkokDate, { dateFormat, timeMode: "12h" })).toBe("5 มิถุนายน 2569 10:50");
    }
  );

  it("uses display settings persisted from a public API snapshot", () => {
    const storageKey = projectSettings.storageKeys.displaySettings;
    window.localStorage.setItem(storageKey, JSON.stringify({ dateFormat: "d/m/Y", timeMode: "24h" }));

    expect(formatDisplayDate(bangkokBoundaryUtc)).toBe("01/08/2569");
  });

  it("shows Buddhist Era examples for every Admin Settings preset", () => {
    expect(dateFormatPresets.map((preset) => preset.label)).toEqual([
      "27 เมษายน 2569 (j F Y)",
      "เมษายน 27, 2569 (F j, Y)",
      "2569-04-27 (Y-m-d)",
      "04/27/2569 (m/d/Y)",
      "27/04/2569 (d/m/Y)"
    ]);
  });

  it("repairs stale stored display settings when they are read", () => {
    const storageKey = projectSettings.storageKeys.displaySettings;
    window.localStorage.setItem(storageKey, JSON.stringify({ dateFormat: "D MMMM MMMM YYYY YYYY", timeMode: "12h" }));

    expect(getStoredDisplaySettings()).toEqual(defaultDisplaySettings);
    expect(JSON.parse(window.localStorage.getItem(storageKey) || "{}")).toEqual(defaultDisplaySettings);
  });
});
