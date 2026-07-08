import type { CalendarEvent } from "../cms-events/types";
import type { PublicEventListSnapshot } from "./types";

const forbiddenInternalKeys = ["end_date", "updated_at"] as const;
const validStatuses = new Set(["confirmed", "draft", "cancelled"]);
const validVisibility = new Set(["public", "private"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoString(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function getForbiddenKey(value: Record<string, unknown>) {
  return forbiddenInternalKeys.find((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function assertOptionalString(value: Record<string, unknown>, key: keyof CalendarEvent) {
  if (value[key] !== undefined && typeof value[key] !== "string") {
    throw new Error(`Invalid public-event-list response: item.${key} must be a string when present`);
  }
}

function assertPublicEventItem(value: unknown): asserts value is CalendarEvent {
  if (!isRecord(value)) {
    throw new Error("Invalid public-event-list response: each item must be an object");
  }

  const forbiddenKey = getForbiddenKey(value);

  if (forbiddenKey) {
    throw new Error(`Invalid public-event-list response: item contains snake_case field "${forbiddenKey}"`);
  }

  for (const key of ["id", "title", "date", "audience"] as const) {
    if (typeof value[key] !== "string") {
      throw new Error(`Invalid public-event-list response: item.${key} must be a string`);
    }
  }

  const status = value.status;

  if (typeof status !== "string") {
    throw new Error("Invalid public-event-list response: item.status must be a string");
  }

  if (!validStatuses.has(status)) {
    throw new Error("Invalid public-event-list response: item.status is invalid");
  }

  if (value.visibility !== undefined && !validVisibility.has(String(value.visibility))) {
    throw new Error("Invalid public-event-list response: item.visibility is invalid");
  }

  for (const key of ["endDate", "location", "description", "category", "visibility", "updatedAt"] as const) {
    assertOptionalString(value, key);
  }
}

export function assertPublicEventListSnapshot(value: unknown): asserts value is PublicEventListSnapshot {
  if (!isRecord(value)) {
    throw new Error("Invalid public-event-list response: snapshot must be an object");
  }

  if (!Array.isArray(value.items)) {
    throw new Error("Invalid public-event-list response: items must be an array");
  }

  if (!isIsoString(value.generatedAt)) {
    throw new Error("Invalid public-event-list response: generatedAt must be an ISO string");
  }

  value.items.forEach(assertPublicEventItem);
}

export function isPublicEventListSnapshot(value: unknown): value is PublicEventListSnapshot {
  try {
    assertPublicEventListSnapshot(value);
    return true;
  } catch {
    return false;
  }
}
