import { deleteCalendarEventFromCloudflare, saveCalendarEventToCloudflare } from "../admin-write/cloudflareApi";
import type { CalendarEventInput } from "./types";
export type { CalendarEventInput } from "./types";

export function saveCalendarEvent(input: CalendarEventInput) {
  return saveCalendarEventToCloudflare(input);
}

export function deleteCalendarEvent(id: string) {
  return deleteCalendarEventFromCloudflare(id);
}
