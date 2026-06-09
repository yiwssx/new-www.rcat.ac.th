import { buildCloudflarePublicApiUrl } from "../../config/publicApiProvider";
import { assertPublicDocumentListSnapshot } from "./contract";
import type { PublicDocumentListSnapshot } from "./types";

function createErrorWithCause(message: string, cause: unknown) {
  const error = new Error(message) as Error & { cause?: unknown };
  error.cause = cause;

  return error;
}

export async function getPublicDocumentListFromCloudflare(): Promise<PublicDocumentListSnapshot> {
  const response = await fetch(buildCloudflarePublicApiUrl("/api/public/documents"), {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Cloudflare public-document-list request failed with HTTP ${response.status}`);
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    throw createErrorWithCause("Cloudflare public-document-list returned invalid JSON", error);
  }

  assertPublicDocumentListSnapshot(payload);

  return payload;
}
