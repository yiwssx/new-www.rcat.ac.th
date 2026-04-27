import { describe, expect, it } from "vitest";
import {
  getCalendarDateRangeError,
  isEndDateTimeBeforeStart,
  toLocalDateTimeInputValue
} from "./calendar";

describe("calendar utils", () => {
  it("formats valid ISO dates for datetime-local inputs", () => {
    expect(toLocalDateTimeInputValue("2026-04-26T03:30:00.000Z")).toMatch(/2026-04-26T\d{2}:\d{2}/);
    expect(toLocalDateTimeInputValue("")).toBe("");
    expect(toLocalDateTimeInputValue("not-a-date")).toBe("");
  });

  it("detects when the end day is before the start day", () => {
    expect(isEndDateTimeBeforeStart("2026-04-26T10:00", "2026-04-25T23:30")).toBe(true);
    expect(isEndDateTimeBeforeStart("2026-04-26T10:00", "2026-04-26T10:00")).toBe(false);
    expect(isEndDateTimeBeforeStart("2026-04-26T10:00", "2026-04-26T00:00")).toBe(false);
    expect(isEndDateTimeBeforeStart("2026-04-26T10:00", "2026-04-26T11:00")).toBe(false);
  });

  it("returns a user-facing validation error only for invalid ranges", () => {
    expect(getCalendarDateRangeError("2026-04-26T10:00", "")).toBe("");
    expect(getCalendarDateRangeError("2026-04-26T10:00", "2026-04-25T23:30")).toBe(
      "End date must be the same as or after the start date."
    );
    expect(getCalendarDateRangeError("2026-04-26T10:00", "2026-04-26T00:00")).toBe("");
  });
});
