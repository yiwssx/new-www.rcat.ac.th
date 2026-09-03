import { requestCloudflareAdmin } from "../admin-write/cloudflareApi";

export type RuntimeIncidentKind = "runtime_error" | "unhandled_rejection" | "api_failure";
export type RuntimeIncidentSurface = "public" | "admin" | "auth" | "unknown";

export interface RuntimeIncidentItem {
  id: string;
  kind: RuntimeIncidentKind;
  surface: RuntimeIncidentSurface;
  pathname: string;
  errorName: string;
  apiMethod?: string;
  httpStatus?: number;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  requestId?: string;
}

export interface RuntimeIncidentFeed {
  generatedAt: string;
  windowHours: number;
  items: RuntimeIncidentItem[];
}

export interface RuntimeIncidentFeedOptions {
  hours?: number;
  limit?: number;
}

function boundedInteger(value: number | undefined, fallback: number, minimum: number, maximum: number) {
  return Number.isInteger(value) ? Math.min(maximum, Math.max(minimum, Number(value))) : fallback;
}

export function getRuntimeIncidentFeed(options: RuntimeIncidentFeedOptions = {}) {
  const search = new URLSearchParams({
    hours: String(boundedInteger(options.hours, 24, 1, 24 * 7)),
    limit: String(boundedInteger(options.limit, 25, 1, 50))
  });

  return requestCloudflareAdmin<RuntimeIncidentFeed>(`/api/admin/runtime-incidents?${search.toString()}`);
}
