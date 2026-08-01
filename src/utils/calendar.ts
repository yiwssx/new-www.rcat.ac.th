const THAI_UTC_OFFSET = "+07:00";
const LOCAL_DATETIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;

function isValidGregorianDate(value: string) {
  const [yearValue, monthValue, dayValue] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

function parseLocalDateTimeInputValue(value: string) {
  const match = LOCAL_DATETIME_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, date, hour, minute] = match;

  if (!isValidGregorianDate(date) || Number(hour) > 23 || Number(minute) > 59) {
    return null;
  }

  return { date, hour, minute };
}

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
    return parseLocalDateTimeInputValue(value) ? value : "";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : formatThaiDateTimeParts(parsed);
}

export function fromLocalDateTimeInputValue(value: string) {
  const parsed = parseLocalDateTimeInputValue(value);

  if (!parsed) {
    return "";
  }

  const { date, hour, minute } = parsed;
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
