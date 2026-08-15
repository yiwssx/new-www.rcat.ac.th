import { randomUUID } from "node:crypto";

export const RCAT_REQUEST_ID_HEADER = "X-RCAT-Request-ID";

const REQUEST_ID_SYMBOL = Symbol.for("rcat.request-id");
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isValidRequestId(value) {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

export function getNodeRequestId(request) {
  const value = request?.[REQUEST_ID_SYMBOL];
  return isValidRequestId(value) ? value.toLowerCase() : "";
}

export function ensureNodeRequestId(request, response, options = {}) {
  const existing = getNodeRequestId(request);
  const createId = options.createId ?? randomUUID;
  const requestId = existing || createId().toLowerCase();

  if (!isValidRequestId(requestId)) {
    throw new Error("request ID generator returned an invalid value");
  }

  if (request && !existing) {
    Object.defineProperty(request, REQUEST_ID_SYMBOL, {
      configurable: false,
      enumerable: false,
      value: requestId,
      writable: false
    });
  }

  if (response && typeof response.setHeader === "function") {
    response.setHeader(RCAT_REQUEST_ID_HEADER, requestId);
  }

  return requestId;
}

export function getSafeRequestPathname(value) {
  try {
    return new URL(value || "/", "https://request.invalid").pathname;
  } catch {
    return "/invalid-request-url";
  }
}

export function logOperationalError({
  component,
  error,
  event,
  logger = console.error,
  method,
  pathname,
  requestId,
  status
}) {
  const payload = {
    level: "error",
    event,
    component,
    requestId,
    method: String(method || "UNKNOWN").toUpperCase(),
    pathname: getSafeRequestPathname(pathname),
    ...(Number.isInteger(status) ? { status } : {}),
    errorName: error instanceof Error && error.name ? error.name : "Error"
  };

  logger(JSON.stringify(payload));
}
