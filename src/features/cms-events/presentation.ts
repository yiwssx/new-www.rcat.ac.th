import { formatDisplayDateTime } from "../../utils/dateDisplay";
import type { CalendarEvent } from "./types";

export type EventLifecycle = "ended" | "ongoing" | "upcoming";

export const EVENT_LIFECYCLE_LABELS: Record<EventLifecycle, string> = {
  ended: "สิ้นสุดแล้ว",
  ongoing: "กำลังดำเนิน",
  upcoming: "กำลังจะมาถึง"
};

function getValidTimestamp(value: string | undefined) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getEventLifecycle(event: Pick<CalendarEvent, "date" | "endDate">, nowMs = Date.now()): EventLifecycle {
  const startMs = getValidTimestamp(event.date);

  if (startMs === null) {
    return "upcoming";
  }

  const parsedEndMs = getValidTimestamp(event.endDate);
  const endMs = parsedEndMs !== null && parsedEndMs >= startMs ? parsedEndMs : startMs;

  if (nowMs > endMs) {
    return "ended";
  }

  if (nowMs >= startMs) {
    return "ongoing";
  }

  return "upcoming";
}

export function formatEventDateTimeRange(event: Pick<CalendarEvent, "date" | "endDate">) {
  const startLabel = formatDisplayDateTime(event.date);
  const endLabel = event.endDate ? formatDisplayDateTime(event.endDate) : "ไม่ระบุวันเวลาสิ้นสุด";

  return `${startLabel} - ${endLabel}`;
}
