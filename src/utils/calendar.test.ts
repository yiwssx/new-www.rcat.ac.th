import { describe, expect, it } from "vitest";
import {
  fromLocalDateTimeInputValue,
  getCalendarDateRangeError,
  isEndDateTimeBeforeStart,
  toLocalDateTimeInputValue
} from "./calendar";

describe("calendar utils", () => {
  it("formats valid ISO dates for datetime-local inputs", () => {
    expect(toLocalDateTimeInputValue("2026-04-26T03:30:00.000Z")).toBe("2026-04-26T10:30");
    expect(toLocalDateTimeInputValue("")).toBe("");
    expect(toLocalDateTimeInputValue("not-a-date")).toBe("");
  });

  it("detects when the end time is before the start time", () => {
    expect(isEndDateTimeBeforeStart("2026-04-26T10:00", "2026-04-25T23:30")).toBe(true);
    expect(isEndDateTimeBeforeStart("2026-04-26T10:00", "2026-04-26T10:00")).toBe(false);
    expect(isEndDateTimeBeforeStart("2026-04-26T10:00", "2026-04-26T00:00")).toBe(true);
    expect(isEndDateTimeBeforeStart("2026-04-26T10:00", "2026-04-26T11:00")).toBe(false);
  });

  it("returns a user-facing validation error only for invalid ranges", () => {
    expect(getCalendarDateRangeError("2026-04-26T10:00", "")).toBe("");
    expect(getCalendarDateRangeError("2026-04-26T10:00", "2026-04-25T23:30")).toBe(
      "วันที่สิ้นสุดต้องเป็นวันเดียวกันหรือหลังวันที่เริ่มต้น"
    );
    expect(getCalendarDateRangeError("2026-04-26T10:00", "2026-04-26T00:00")).not.toBe("");
  });

  it.each(["00:00", "08:30", "12:00", "18:45", "23:59"])(
    "preserves arbitrary Thai-local time %s without timezone drift",
    (time) => {
      const localValue = `2026-06-21T${time}`;
      const persisted = fromLocalDateTimeInputValue(localValue);

      expect(persisted).toBe(`${localValue}:00+07:00`);
      expect(toLocalDateTimeInputValue(persisted)).toBe(localValue);
    }
  );

  it("rejects invalid local datetime values", () => {
    expect(fromLocalDateTimeInputValue("2026-06-21T24:00")).toBe("");
    expect(fromLocalDateTimeInputValue("not-a-date")).toBe("");
  });
});
