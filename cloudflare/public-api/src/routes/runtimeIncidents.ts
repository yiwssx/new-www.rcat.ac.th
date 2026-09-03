import {
  enforcePublicAnalyticsRateLimit,
  PublicAnalyticsRateLimitExceeded,
  PublicAnalyticsRateLimitUnavailable
} from "../analyticsAbuseGuard";
import { authenticateAdminRequest } from "../auth/adminAccess";
import { requireAdminCapability } from "../auth/adminCapabilities";
import { requireD1Database } from "../db/documentsRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";
import {
  enforceSecurityRateLimit,
  SecurityRateLimitExceeded,
  SecurityRateLimitUnavailable
} from "../securityRateLimit";

export const RUNTIME_INCIDENT_PATH = "/api/public/runtime-incident";
export const ADMIN_RUNTIME_INCIDENTS_PATH = "/api/admin/runtime-incidents";

const INCIDENT_DEDUPE_BUCKET_MS = 5 * 60 * 1000;
const MAX_RUNTIME_INCIDENTS = 2_000;
const MAX_PATHNAME_LENGTH = 240;
const MAX_FEED_LIMIT = 50;
const MAX_FEED_WINDOW_HOURS = 24 * 7;
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_SEGMENT_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LONG_HEX_SEGMENT_PATTERN = /^[0-9a-f]{32,}$/i;
const TOKENISH_SEGMENT_PATTERN = /^[A-Za-z0-9_-]{40,}$/;
function containsControlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}
const SENSITIVE_PATH_SEGMENTS = new Set([
  "token",
  "tokens",
  "reset",
  "reset-password",
  "password-reset",
  "recovery",
  "recover",
  "invitation",
  "invitations",
  "invite",
  "mfa",
  "verify",
  "verification"
]);
const RUNTIME_INCIDENT_KINDS = new Set(["runtime_error", "unhandled_rejection", "api_failure"] as const);
const RUNTIME_INCIDENT_SURFACES = new Set(["public", "admin", "auth", "unknown"] as const);
const API_METHODS = new Set(["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"]);
const SAFE_ERROR_NAMES = new Set([
  "Error",
  "TypeError",
  "ReferenceError",
  "RangeError",
  "SyntaxError",
  "URIError",
  "EvalError",
  "AggregateError",
  "DOMException",
  "AbortError",
  "NetworkError",
  "HttpError",
  "ChunkLoadError",
  "CmsAuthError",
  "CmsStepUpReplayError",
  "PublicReadError",
  "AdminStaleRevisionError",
  "AdminDuplicateSlugError",
  "NonErrorRejection",
  "OtherError"
]);

type RuntimeIncidentKind = "runtime_error" | "unhandled_rejection" | "api_failure";
type RuntimeIncidentSurface = "public" | "admin" | "auth" | "unknown";

export interface RuntimeIncidentInput {
  kind: RuntimeIncidentKind;
  surface: RuntimeIncidentSurface;
  pathname: string;
  errorName: string;
  apiMethod: string;
  httpStatus: number | null;
  requestId: string;
}

interface RuntimeIncidentRow {
  id: string;
  kind: RuntimeIncidentKind;
  surface: RuntimeIncidentSurface;
  pathname: string;
  error_name: string;
  api_method: string;
  http_status: number | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  last_request_id: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isSensitivePathSegment(value: string) {
  const normalized = value.trim().toLowerCase();
  return SENSITIVE_PATH_SEGMENTS.has(normalized);
}

function shouldRedactPathSegment(value: string) {
  const decoded = decodePathSegment(value);
  return (
    !decoded ||
    containsControlCharacter(decoded) ||
    UUID_SEGMENT_PATTERN.test(decoded) ||
    LONG_HEX_SEGMENT_PATTERN.test(decoded) ||
    TOKENISH_SEGMENT_PATTERN.test(decoded)
  );
}

export function sanitizeRuntimeIncidentPathname(value: unknown) {
  if (typeof value !== "string") {
    return "/";
  }

  const trimmed = value.trim();
  const separatorIndex = trimmed.search(/[?#]/u);
  const rawPathname = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex) : trimmed;

  if (!rawPathname.startsWith("/")) {
    return "/";
  }

  const segments = rawPathname.split("/");
  const sanitized: string[] = [];
  let previousWasSensitive = false;

  for (const segment of segments) {
    const decoded = decodePathSegment(segment);
    const redact = previousWasSensitive || shouldRedactPathSegment(segment);
    sanitized.push(redact && segment ? ":redacted" : segment);
    previousWasSensitive = isSensitivePathSegment(decoded);
  }

  const pathname = sanitized.join("/").slice(0, MAX_PATHNAME_LENGTH);
  return pathname || "/";
}

function normalizeRequestId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return REQUEST_ID_PATTERN.test(trimmed) ? trimmed.toLowerCase() : "";
}

function normalizeRuntimeErrorName(value: unknown, fallback: string) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) {
    return fallback;
  }

  return SAFE_ERROR_NAMES.has(candidate) ? candidate : "OtherError";
}

function normalizeSurface(value: unknown): RuntimeIncidentSurface {
  return typeof value === "string" && RUNTIME_INCIDENT_SURFACES.has(value as RuntimeIncidentSurface)
    ? (value as RuntimeIncidentSurface)
    : "unknown";
}

function normalizeApiMethod(value: unknown) {
  const method = typeof value === "string" ? value.trim().toUpperCase() : "";
  return API_METHODS.has(method) ? method : "";
}

export function parseRuntimeIncidentInput(value: unknown): RuntimeIncidentInput | null {
  if (
    !isRecord(value) ||
    typeof value.kind !== "string" ||
    !RUNTIME_INCIDENT_KINDS.has(value.kind as RuntimeIncidentKind)
  ) {
    return null;
  }

  const kind = value.kind as RuntimeIncidentKind;
  const surface = normalizeSurface(value.surface);
  const pathname = sanitizeRuntimeIncidentPathname(value.pathname);
  const requestId = normalizeRequestId(value.requestId);

  if (kind === "api_failure") {
    const apiMethod = normalizeApiMethod(value.apiMethod);
    if (!apiMethod) {
      return null;
    }

    const numericStatus = value.httpStatus === null || value.httpStatus === undefined ? null : Number(value.httpStatus);
    const httpStatus = Number.isInteger(numericStatus) ? Number(numericStatus) : null;
    if (httpStatus !== null && (httpStatus < 500 || httpStatus > 599)) {
      return null;
    }

    return {
      kind,
      surface,
      pathname,
      errorName: httpStatus === null ? "NetworkError" : "HttpError",
      apiMethod,
      httpStatus,
      requestId
    };
  }

  return {
    kind,
    surface,
    pathname,
    errorName: normalizeRuntimeErrorName(
      value.errorName,
      kind === "unhandled_rejection" ? "NonErrorRejection" : "Error"
    ),
    apiMethod: "",
    httpStatus: null,
    requestId
  };
}

export function getRuntimeIncidentBucketStart(now = new Date()) {
  return new Date(Math.floor(now.getTime() / INCIDENT_DEDUPE_BUCKET_MS) * INCIDENT_DEDUPE_BUCKET_MS).toISOString();
}

async function hashIncidentFingerprint(input: RuntimeIncidentInput) {
  const source = JSON.stringify([
    input.kind,
    input.surface,
    input.pathname,
    input.errorName,
    input.apiMethod,
    input.httpStatus
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function noStoreJson(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return json(data, { ...init, headers });
}

function noStoreError(message: string, status: number, extra: Record<string, unknown> = {}) {
  const response = jsonError(message, status, extra);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function withNoStore(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { headers, status: response.status, statusText: response.statusText });
}

async function persistRuntimeIncident(env: Env, input: RuntimeIncidentInput, now = new Date()) {
  const db = requireD1Database(env);
  const fingerprint = await hashIncidentFingerprint(input);
  const dedupeKey = `v1_${fingerprint}`;
  const bucketStartedAt = getRuntimeIncidentBucketStart(now);
  const occurredAt = now.toISOString();
  const id = `runtime-${bucketStartedAt.replace(/\D/gu, "").slice(0, 12)}-${fingerprint.slice(0, 20)}`;

  await db.batch([
    db
      .prepare(
        `INSERT INTO runtime_incidents
          (id, dedupe_key, bucket_started_at, kind, surface, pathname, error_name, api_method, http_status,
           occurrence_count, first_seen_at, last_seen_at, last_request_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
         ON CONFLICT(dedupe_key, bucket_started_at) DO UPDATE SET
           occurrence_count = runtime_incidents.occurrence_count + 1,
           last_seen_at = excluded.last_seen_at,
           last_request_id = CASE
             WHEN excluded.last_request_id <> '' THEN excluded.last_request_id
             ELSE runtime_incidents.last_request_id
           END`
      )
      .bind(
        id,
        dedupeKey,
        bucketStartedAt,
        input.kind,
        input.surface,
        input.pathname,
        input.errorName,
        input.apiMethod,
        input.httpStatus,
        occurredAt,
        occurredAt,
        input.requestId
      ),
    db
      .prepare(
        `DELETE FROM runtime_incidents
         WHERE id IN (
           SELECT id
           FROM runtime_incidents
           ORDER BY last_seen_at DESC, id DESC
           LIMIT -1 OFFSET ?
         )`
      )
      .bind(MAX_RUNTIME_INCIDENTS)
  ]);
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

export async function recordRuntimeIncident(request: Request, env: Env) {
  if (!env.DB) {
    return noStoreError("runtime incident storage is unavailable", 503, { resource: "runtime-incident" });
  }

  try {
    await enforcePublicAnalyticsRateLimit(request, env, { scope: "runtime-incident" });
  } catch (error) {
    if (error instanceof PublicAnalyticsRateLimitExceeded) {
      const response = noStoreError("too many runtime incident reports", 429, { resource: "runtime-incident" });
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
      return response;
    }

    if (error instanceof PublicAnalyticsRateLimitUnavailable) {
      return noStoreError("runtime incident rate limiter is unavailable", 503, { resource: "runtime-incident" });
    }

    throw error;
  }

  const input = parseRuntimeIncidentInput(await readJsonBody(request));
  if (!input) {
    return noStoreError("invalid runtime incident", 400, { resource: "runtime-incident" });
  }

  await persistRuntimeIncident(env, input);
  return noStoreJson({ accepted: true }, { status: 202 });
}

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function mapRuntimeIncident(row: RuntimeIncidentRow) {
  return {
    id: row.id,
    kind: row.kind,
    surface: row.surface,
    pathname: sanitizeRuntimeIncidentPathname(row.pathname),
    errorName: normalizeRuntimeErrorName(row.error_name, "OtherError"),
    apiMethod: normalizeApiMethod(row.api_method) || undefined,
    httpStatus: Number.isInteger(row.http_status) ? row.http_status : undefined,
    occurrenceCount: Math.max(1, Number(row.occurrence_count) || 1),
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    requestId: normalizeRequestId(row.last_request_id) || undefined
  };
}

async function authorizeAdminIncidentFeed(request: Request, env: Env) {
  try {
    await enforceSecurityRateLimit(request, env, "admin-api");
  } catch (error) {
    if (error instanceof SecurityRateLimitExceeded) {
      const response = noStoreError("too many admin requests", 429, { resource: "runtime-incidents" });
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
      return { identity: null, response };
    }

    if (error instanceof SecurityRateLimitUnavailable) {
      return {
        identity: null,
        response: noStoreError("admin security service is unavailable", 503, { resource: "runtime-incidents" })
      };
    }

    throw error;
  }

  const authResult = await authenticateAdminRequest(request, env);
  if (authResult.response || !authResult.identity) {
    return {
      identity: null,
      response: withNoStore(authResult.response ?? noStoreError("CMS session is required", 401))
    };
  }

  const permissionResponse = requireAdminCapability(authResult.identity, "dashboard.read", {
    resource: "runtime-incidents"
  });
  return {
    identity: permissionResponse ? null : authResult.identity,
    response: permissionResponse ? withNoStore(permissionResponse) : null
  };
}

export async function handleAdminRuntimeIncidents(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== ADMIN_RUNTIME_INCIDENTS_PATH) {
    return null;
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { Allow: "GET, OPTIONS", "Cache-Control": "no-store" } });
  }

  if (request.method !== "GET") {
    const response = noStoreError("method not allowed", 405, { resource: "runtime-incidents" });
    response.headers.set("Allow", "GET, OPTIONS");
    return response;
  }

  const authorization = await authorizeAdminIncidentFeed(request, env);
  if (authorization.response || !authorization.identity) {
    return authorization.response;
  }

  if (!env.DB) {
    return noStoreError("runtime incident storage is unavailable", 503, { resource: "runtime-incidents" });
  }

  const limit = boundedInteger(url.searchParams.get("limit"), 25, 1, MAX_FEED_LIMIT);
  const windowHours = boundedInteger(url.searchParams.get("hours"), 24, 1, MAX_FEED_WINDOW_HOURS);
  const generatedAt = new Date();
  const cutoff = new Date(generatedAt.getTime() - windowHours * 60 * 60 * 1000).toISOString();
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT id, kind, surface, pathname, error_name, api_method, http_status, occurrence_count,
              first_seen_at, last_seen_at, last_request_id
       FROM runtime_incidents
       WHERE last_seen_at >= ?
       ORDER BY last_seen_at DESC, id DESC
       LIMIT ?`
    )
    .bind(cutoff, limit)
    .all<RuntimeIncidentRow>();

  return noStoreJson({
    generatedAt: generatedAt.toISOString(),
    windowHours,
    items: (result.results ?? []).map(mapRuntimeIncident)
  });
}
