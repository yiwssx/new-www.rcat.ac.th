import { buildCloudflarePublicApiUrl } from "../../config/publicApiProvider";
import { isAbortLikeError, PublicReadError } from "./errors";

export interface PublicReadRequestOptions {
  signal?: AbortSignal;
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

export async function getPublicJson(
  path: string,
  resource: string,
  options: PublicReadRequestOptions = {}
): Promise<Record<string, unknown>> {
  let response: Response;

  try {
    response = await fetch(buildCloudflarePublicApiUrl(path), {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      signal: options.signal
    });
  } catch (error) {
    if (isAbortLikeError(error) || options.signal?.aborted) {
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
  }

  if (!response.ok) {
    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      // Keep the generic HTTP status message when the error body is not JSON.
    }

    const detail = readErrorDetail(payload);
    throw new PublicReadError(detail.error || `Cloudflare ${resource} request failed with HTTP ${response.status}`, {
      kind: "http",
      resource,
      status: response.status,
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
