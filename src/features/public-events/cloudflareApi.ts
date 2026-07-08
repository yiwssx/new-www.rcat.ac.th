import { buildCloudflarePublicApiUrl } from "../../config/publicApiProvider";
import { assertPublicEventListSnapshot } from "./contract";
import type { PublicEventListSnapshot } from "./types";

function createErrorWithCause(message: string, cause: unknown) {
  const error = new Error(message) as Error & { cause?: unknown };
  error.cause = cause;

  return error;
}

export async function getPublicEventListFromCloudflare(): Promise<PublicEventListSnapshot> {
  const response = await fetch(buildCloudflarePublicApiUrl("/api/public/events"), {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Cloudflare public-event-list request failed with HTTP ${response.status}`);
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    throw createErrorWithCause("Cloudflare public-event-list returned invalid JSON", error);
  }

  assertPublicEventListSnapshot(payload);

  return payload;
}
