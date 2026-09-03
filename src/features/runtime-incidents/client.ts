import { buildCloudflarePublicApiUrl } from "../../config/publicApiProvider";

export const RUNTIME_INCIDENT_PATH = "/api/public/runtime-incident";
export const RUNTIME_INCIDENT_DEDUPE_MS = 60_000;

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_SEGMENT_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LONG_HEX_SEGMENT_PATTERN = /^[0-9a-f]{32,}$/i;
const TOKENISH_SEGMENT_PATTERN = /^[A-Za-z0-9_-]{40,}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const MAX_PATHNAME_LENGTH = 240;
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
const IGNORED_API_PATHS = new Set([
  RUNTIME_INCIDENT_PATH,
  "/api/public/site-view",
  "/api/public/presence",
  "/api/public/content-view"
]);

export type RuntimeIncidentKind = "runtime_error" | "unhandled_rejection" | "api_failure";
export type RuntimeIncidentSurface = "public" | "admin" | "auth" | "unknown";

export interface RuntimeIncidentPayload {
  kind: RuntimeIncidentKind;
  surface: RuntimeIncidentSurface;
  pathname: string;
  errorName?: string;
  apiMethod?: string;
  httpStatus?: number;
  requestId?: string;
}

interface RuntimeIncidentReporterInput {
  kind: RuntimeIncidentKind;
  pathname: string;
  surface: RuntimeIncidentSurface;
  errorName?: string;
  apiMethod?: string;
  httpStatus?: number | null;
  requestId?: string | null;
}

export interface RuntimeIncidentRecorderOptions {
  enabled?: boolean;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

let runtimeIncidentRecorderInstalled = false;

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isSensitivePathSegment(value: string) {
  return SENSITIVE_PATH_SEGMENTS.has(value.trim().toLowerCase());
}

function shouldRedactPathSegment(value: string) {
  const decoded = decodePathSegment(value);
  return (
    !decoded ||
    CONTROL_CHARACTER_PATTERN.test(decoded) ||
    UUID_SEGMENT_PATTERN.test(decoded) ||
    LONG_HEX_SEGMENT_PATTERN.test(decoded) ||
    TOKENISH_SEGMENT_PATTERN.test(decoded)
  );
}

export function sanitizeRuntimeIncidentPathname(value: string) {
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

export function getRuntimeIncidentSurface(pathname: string): RuntimeIncidentSurface {
  const normalized = sanitizeRuntimeIncidentPathname(pathname).toLowerCase();

  if (
    normalized === "/admin/login" ||
    normalized.startsWith("/admin/reset-password") ||
    normalized.startsWith("/admin/invitation") ||
    normalized.startsWith("/admin/mfa")
  ) {
    return "auth";
  }

  return normalized.startsWith("/admin") ? "admin" : "public";
}

function normalizeRequestId(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return REQUEST_ID_PATTERN.test(trimmed) ? trimmed.toLowerCase() : undefined;
}

function normalizeErrorName(value: unknown, fallback: string) {
  const candidate = value instanceof Error ? value.name : typeof value === "string" ? value.trim() : "";
  if (!candidate) {
    return fallback;
  }

  return SAFE_ERROR_NAMES.has(candidate) ? candidate : "OtherError";
}

function normalizeApiMethod(value: string | undefined) {
  const method = (value || "GET").trim().toUpperCase();
  return ["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"].includes(method) ? method : "GET";
}

export function buildRuntimeIncidentPayload(input: RuntimeIncidentReporterInput): RuntimeIncidentPayload {
  const base = {
    kind: input.kind,
    surface: input.surface,
    pathname: sanitizeRuntimeIncidentPathname(input.pathname)
  } as const;
  const requestId = normalizeRequestId(input.requestId);

  if (input.kind === "api_failure") {
    return {
      ...base,
      apiMethod: normalizeApiMethod(input.apiMethod),
      ...(Number.isInteger(input.httpStatus) && Number(input.httpStatus) >= 500 && Number(input.httpStatus) <= 599
        ? { httpStatus: Number(input.httpStatus) }
        : {}),
      ...(requestId ? { requestId } : {})
    };
  }

  return {
    ...base,
    errorName: normalizeErrorName(
      input.errorName,
      input.kind === "unhandled_rejection" ? "NonErrorRejection" : "Error"
    ),
    ...(requestId ? { requestId } : {})
  };
}

function readFetchUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}

function readFetchMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) {
    return normalizeApiMethod(init.method);
  }

  return typeof Request !== "undefined" && input instanceof Request ? normalizeApiMethod(input.method) : "GET";
}

function readApiPathname(input: RequestInfo | URL) {
  try {
    return new URL(readFetchUrl(input), window.location.href).pathname;
  } catch {
    return "";
  }
}

function shouldObserveApiRequest(pathname: string) {
  return pathname.startsWith("/api/") && !IGNORED_API_PATHS.has(pathname);
}

function getDefaultEndpoint() {
  return buildCloudflarePublicApiUrl(RUNTIME_INCIDENT_PATH);
}

function getPageContext() {
  const pathname = sanitizeRuntimeIncidentPathname(window.location.pathname);
  return {
    pathname,
    surface: getRuntimeIncidentSurface(pathname)
  };
}

function createDedupeKey(payload: RuntimeIncidentPayload) {
  return JSON.stringify([
    payload.kind,
    payload.surface,
    payload.pathname,
    payload.errorName ?? "",
    payload.apiMethod ?? "",
    payload.httpStatus ?? null
  ]);
}

function pruneDedupeMap(entries: Map<string, number>, now: number) {
  if (entries.size <= 100) {
    return;
  }

  for (const [key, seenAt] of entries) {
    if (now - seenAt >= RUNTIME_INCIDENT_DEDUPE_MS) {
      entries.delete(key);
    }
  }
}

export function installRuntimeIncidentRecorder(options: RuntimeIncidentRecorderOptions = {}) {
  const enabled = options.enabled ?? import.meta.env.PROD;

  if (!enabled || typeof window === "undefined" || runtimeIncidentRecorderInstalled || typeof globalThis.fetch !== "function") {
    return () => undefined;
  }

  runtimeIncidentRecorderInstalled = true;
  const originalGlobalFetch = globalThis.fetch;
  const nativeFetch = options.fetchImpl ?? originalGlobalFetch.bind(globalThis);
  const now = options.now ?? Date.now;
  const dedupeEntries = new Map<string, number>();

  const report = (input: RuntimeIncidentReporterInput) => {
    const payload = buildRuntimeIncidentPayload(input);
    const dedupeKey = createDedupeKey(payload);
    const currentTime = now();
    const previousTime = dedupeEntries.get(dedupeKey) ?? 0;

    if (previousTime > 0 && currentTime - previousTime < RUNTIME_INCIDENT_DEDUPE_MS) {
      return false;
    }

    dedupeEntries.set(dedupeKey, currentTime);
    pruneDedupeMap(dedupeEntries, currentTime);

    try {
      const endpoint = options.endpoint ?? getDefaultEndpoint();
      void nativeFetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => undefined);
      return true;
    } catch {
      return false;
    }
  };

  const onError = (event: ErrorEvent) => {
    const page = getPageContext();
    report({
      kind: "runtime_error",
      ...page,
      errorName: normalizeErrorName(event.error, "Error")
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const page = getPageContext();
    report({
      kind: "unhandled_rejection",
      ...page,
      errorName: normalizeErrorName(event.reason, "NonErrorRejection")
    });
  };

  const wrappedFetch: typeof fetch = async (input, init) => {
    const apiPathname = readApiPathname(input);
    const observe = shouldObserveApiRequest(apiPathname);
    const apiMethod = readFetchMethod(input, init);

    try {
      const response = await nativeFetch(input, init);
      if (observe && response.status >= 500 && response.status <= 599) {
        const page = getPageContext();
        report({
          kind: "api_failure",
          ...page,
          pathname: apiPathname,
          apiMethod,
          httpStatus: response.status,
          requestId: response.headers.get("X-RCAT-Request-ID")
        });
      }
      return response;
    } catch (error) {
      if (observe) {
        const page = getPageContext();
        report({
          kind: "api_failure",
          ...page,
          pathname: apiPathname,
          apiMethod,
          httpStatus: null
        });
      }
      throw error;
    }
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  globalThis.fetch = wrappedFetch;

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    if (globalThis.fetch === wrappedFetch) {
      globalThis.fetch = originalGlobalFetch;
    }
    runtimeIncidentRecorderInstalled = false;
  };
}
