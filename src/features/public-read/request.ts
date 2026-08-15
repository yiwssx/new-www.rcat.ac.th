import { buildCloudflarePublicApiUrl } from "../../config/publicApiProvider";
import { isAbortLikeError, PublicReadError } from "./errors";

export const PUBLIC_READ_DEFAULT_TIMEOUT_MS = 4_000;
const PUBLIC_READ_MAX_TIMEOUT_MS = 60_000;

export interface PublicReadRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface PublicJsonRequestOptions extends PublicReadRequestOptions {
  httpErrorMessage?: "backend" | "generic";
}

interface RequestDeadline {
  signal: AbortSignal;
  didTimeout: () => boolean;
  cleanup: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readErrorDetail(payload: unknown) {
  if (!isRecord(payload)) {
    return { error: "", diagnostic: "", suggestedMigration: "" };
  }

  return {
    error: typeof payload.error === "string" ? payload.error : "",
    diagnostic: typeof payload.diagnostic === "string" ? payload.diagnostic : "",
    suggestedMigration: typeof payload.suggestedMigration === "string" ? payload.suggestedMigration : ""
  };
}

function normalizeTimeoutMs(value: number | undefined) {
  if (value === undefined) return PUBLIC_READ_DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(value) || value <= 0) return PUBLIC_READ_DEFAULT_TIMEOUT_MS;
  return Math.min(Math.floor(value), PUBLIC_READ_MAX_TIMEOUT_MS);
}

function createRequestDeadline(parentSignal: AbortSignal | undefined, timeoutMs: number): RequestDeadline {
  const controller = new AbortController();
  let timedOut = false;

  const abortFromParent = () => controller.abort();
  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timeoutId);
      parentSignal?.removeEventListener("abort", abortFromParent);
    }
  };
}

export async function getPublicJson(
  path: string,
  resource: string,
  options: PublicJsonRequestOptions = {}
): Promise<Record<string, unknown>> {
  const url = buildCloudflarePublicApiUrl(path);
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const deadline = createRequestDeadline(options.signal, timeoutMs);
  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      signal: deadline.signal
    });
  } catch (error) {
    if (deadline.didTimeout()) {
      throw new PublicReadError(`Cloudflare ${resource} request timed out after ${timeoutMs}ms`, {
        kind: "timeout",
        resource,
        cause: error
      });
    }

    if (isAbortLikeError(error) || options.signal?.aborted || deadline.signal.aborted) {
      throw new PublicReadError(`Cloudflare ${resource} request was aborted`, {
        kind: "aborted",
        resource,
        cause: error
      });
    }

    throw new PublicReadError(`Cloudflare ${resource} request failed`, {
      kind: "network",
      resource,
      cause: error
    });
  } finally {
    deadline.cleanup();
  }

  if (!response.ok) {
    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      // Keep the generic HTTP status message when the error body is not JSON.
    }

    const detail = readErrorDetail(payload);
    const genericMessage = `Cloudflare ${resource} request failed with HTTP ${response.status}`;
    const message = options.httpErrorMessage === "generic" ? genericMessage : detail.error || genericMessage;

    throw new PublicReadError(message, {
      kind: "http",
      resource,
      status: response.status,
      backendMessage: detail.error,
      diagnostic: detail.diagnostic,
      suggestedMigration: detail.suggestedMigration
    });
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    throw new PublicReadError(`Cloudflare ${resource} returned invalid JSON`, {
      kind: "invalid-json",
      resource,
      cause: error
    });
  }

  if (!isRecord(payload)) {
    throw new PublicReadError(`Cloudflare ${resource} returned an invalid response`, {
      kind: "invalid-response",
      resource
    });
  }

  return payload;
}

export function asInvalidPublicReadResponse(resource: string, error: unknown): PublicReadError {
  if (error instanceof PublicReadError) {
    return error;
  }

  return new PublicReadError(
    error instanceof Error ? error.message : `Cloudflare ${resource} returned an invalid response`,
    {
      kind: "invalid-response",
      resource,
      cause: error
    }
  );
}
