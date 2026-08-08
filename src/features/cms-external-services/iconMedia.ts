import type { ExternalServiceIconValue } from "./types";

const MEDIA_ICON_PREFIX = "media:";

export function getExternalServiceIconMediaId(value: string | null | undefined) {
  const normalized = String(value || "").trim();

  if (!normalized.startsWith(MEDIA_ICON_PREFIX)) {
    return "";
  }

  return normalized.slice(MEDIA_ICON_PREFIX.length).trim();
}

export function createExternalServiceMediaIconKey(mediaId: string): ExternalServiceIconValue {
  const normalizedMediaId = mediaId.trim();
  return normalizedMediaId ? (`${MEDIA_ICON_PREFIX}${normalizedMediaId}` as ExternalServiceIconValue) : "link";
}

export function normalizeExternalServiceIconValue(value: string | null | undefined): ExternalServiceIconValue {
  const mediaId = getExternalServiceIconMediaId(value);
  return mediaId ? createExternalServiceMediaIconKey(mediaId) : "link";
}
