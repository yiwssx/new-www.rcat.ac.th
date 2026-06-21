import dayjs from "dayjs";

const THAI_UTC_OFFSET = "+07:00";
const LOCAL_DATETIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;

function formatThaiDateTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function toLocalDateTimeInputValue(value?: string) {
  if (!value) {
    return "";
  }

  if (LOCAL_DATETIME_PATTERN.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : formatThaiDateTimeParts(parsed);
}

export function fromLocalDateTimeInputValue(value: string) {
  const match = LOCAL_DATETIME_PATTERN.exec(value.trim());

  if (!match) {
    return "";
  }

  const [, date, hour, minute] = match;
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);

  if (hourNumber > 23 || minuteNumber > 59 || !dayjs(`${date}T${hour}:${minute}`).isValid()) {
    return "";
  }

  return `${date}T${hour}:${minute}:00${THAI_UTC_OFFSET}`;
}

export function isEndDateTimeBeforeStart(startDateTime: string, endDateTime: string) {
  if (!startDateTime || !endDateTime) {
    return false;
  }

  if (!LOCAL_DATETIME_PATTERN.test(startDateTime) || !LOCAL_DATETIME_PATTERN.test(endDateTime)) {
    return false;
  }

  return endDateTime < startDateTime;
}

export function getCalendarDateRangeError(startDateTime: string, endDateTime: string) {
  if (!endDateTime) {
    return "";
  }

  return isEndDateTimeBeforeStart(startDateTime, endDateTime)
    ? "วันที่สิ้นสุดต้องเป็นวันเดียวกันหรือหลังวันที่เริ่มต้น"
    : "";
}
