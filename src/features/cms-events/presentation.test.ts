import { describe, expect, it } from "vitest";
import { formatEventDateTimeRange, getEventLifecycle } from "./presentation";

describe("event presentation", () => {
  const event = {
    date: "2026-07-15T09:00:00+07:00",
    endDate: "2026-07-15T11:00:00+07:00"
  };

  it("returns upcoming before the event starts", () => {
    expect(getEventLifecycle(event, Date.parse("2026-07-15T08:59:59+07:00"))).toBe("upcoming");
  });

  it("returns ongoing at the exact start time", () => {
    expect(getEventLifecycle(event, Date.parse("2026-07-15T09:00:00+07:00"))).toBe("ongoing");
  });

  it("returns ongoing between the start and end times", () => {
    expect(getEventLifecycle(event, Date.parse("2026-07-15T10:00:00+07:00"))).toBe("ongoing");
  });

  it("returns ongoing at the exact end time", () => {
    expect(getEventLifecycle(event, Date.parse("2026-07-15T11:00:00+07:00"))).toBe("ongoing");
  });

  it("returns ended after the event ends", () => {
    expect(getEventLifecycle(event, Date.parse("2026-07-15T11:00:00.001+07:00"))).toBe("ended");
  });

  it("falls back safely when the start date is invalid", () => {
    expect(
      getEventLifecycle(
        {
          date: "invalid-date",
          endDate: "invalid-date"
        },
        Date.parse("2026-07-15T10:00:00+07:00")
      )
    ).toBe("upcoming");
  });

  it("uses the start time as the end time when endDate is missing", () => {
    const eventWithoutEnd = {
      date: "2026-07-15T09:00:00+07:00"
    };

    expect(getEventLifecycle(eventWithoutEnd, Date.parse("2026-07-15T09:00:00+07:00"))).toBe("ongoing");

    expect(getEventLifecycle(eventWithoutEnd, Date.parse("2026-07-15T09:00:00.001+07:00"))).toBe("ended");
  });

  it("formats both the start and end times", () => {
    const value = formatEventDateTimeRange(event);

    expect(value).toContain("09:00");
    expect(value).toContain("11:00");
    expect(value).toContain(" - ");
    expect(value).not.toContain("ไม่ระบุวันเวลาสิ้นสุด");
  });

  it("shows the missing end-time message when endDate is absent", () => {
    const value = formatEventDateTimeRange({
      date: "2026-07-15T09:00:00+07:00"
    });

    expect(value).toContain("09:00");
    expect(value).toContain("ไม่ระบุวันเวลาสิ้นสุด");
  });
});
