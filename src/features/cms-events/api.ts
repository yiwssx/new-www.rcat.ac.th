import { getAdminWriteProvider } from "../../config/adminWriteProvider";
import {
  deleteCalendarEvent as deleteCalendarEventFromAppsScript,
  saveCalendarEvent as saveCalendarEventFromAppsScript
} from "../../services/googleApi";
import { deleteCalendarEventFromCloudflare, saveCalendarEventToCloudflare } from "../admin-write/cloudflareApi";
export type { CalendarEventInput } from "../../services/googleApi";
import type { CalendarEventInput } from "../../services/googleApi";

export function saveCalendarEvent(input: CalendarEventInput) {
  return getAdminWriteProvider() === "cloudflare"
    ? saveCalendarEventToCloudflare(input)
    : saveCalendarEventFromAppsScript(input);
}

export function deleteCalendarEvent(id: string) {
  return getAdminWriteProvider() === "cloudflare"
    ? deleteCalendarEventFromCloudflare(id)
    : deleteCalendarEventFromAppsScript(id);
}
