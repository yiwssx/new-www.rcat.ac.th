import dayjs from "dayjs";

export function toLocalDateTimeInputValue(value?: string) {
  if (!value) {
    return "";
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DDTHH:mm") : "";
}

export function isEndDateTimeBeforeStart(startDateTime: string, endDateTime: string) {
  if (!startDateTime || !endDateTime) {
    return false;
  }

  const start = dayjs(startDateTime);
  const end = dayjs(endDateTime);

  if (!start.isValid() || !end.isValid()) {
    return false;
  }

  return end.startOf("day").isBefore(start.startOf("day"));
}

export function getCalendarDateRangeError(startDateTime: string, endDateTime: string) {
  if (!endDateTime) {
    return "";
  }

  return isEndDateTimeBeforeStart(startDateTime, endDateTime)
    ? "End date must be the same as or after the start date."
    : "";
}
