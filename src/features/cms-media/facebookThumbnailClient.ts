import {
  CMS_CSRF_HEADER_NAME,
  CMS_SESSION_EXPIRED_MESSAGE,
  CmsAuthError,
  notifyCmsSessionExpired,
  readCmsCsrfToken
} from "../cms-auth";
import type { FacebookThumbnailImportInput, MediaAsset } from "./types";

const mediaBridgePath = "/api/apps-script-proxy";
const INVALID_FACEBOOK_THUMBNAIL_RESPONSE = "ระบบสร้างภาพตัวอย่าง Facebook ได้รับการตอบกลับที่ไม่ถูกต้อง";

type BridgeEnvelope = Partial<MediaAsset> & {
  error?: string;
  statusCode?: number;
};

function isMediaAsset(value: unknown): value is MediaAsset {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const asset = value as Record<string, unknown>;
  return (
    typeof asset.id === "string" &&
    Boolean(asset.id) &&
    typeof asset.name === "string" &&
    asset.type === "image" &&
    typeof asset.size === "string" &&
    typeof asset.owner === "string" &&
    typeof asset.driveUrl === "string" &&
    Boolean(asset.driveUrl) &&
    typeof asset.updatedAt === "string"
  );
}

function getSafeErrorMessage(value: unknown) {
  const message = typeof value === "string" ? value.trim() : "";

  if (!message || /<\/?[a-z][\s\S]*>/i.test(message) || /(?:oauth|bearer|token)/i.test(message)) {
    return INVALID_FACEBOOK_THUMBNAIL_RESPONSE;
  }

  return message.slice(0, 240);
}

export async function importFacebookThumbnailFromBridge(
  input: FacebookThumbnailImportInput
): Promise<MediaAsset> {
  const csrfToken = readCmsCsrfToken();

  if (!csrfToken) {
    throw new CmsAuthError(403);
  }

  const response = await fetch(mediaBridgePath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [CMS_CSRF_HEADER_NAME]: csrfToken
    },
    body: JSON.stringify({ resource: "facebookThumbnail", payload: input }),
    cache: "no-store",
    credentials: "include"
  });

  if (response.status === 401) {
    notifyCmsSessionExpired();
    throw new CmsAuthError(401, CMS_SESSION_EXPIRED_MESSAGE);
  }

  let payload: BridgeEnvelope;
  try {
    payload = (await response.json()) as BridgeEnvelope;
  } catch {
    throw new Error(INVALID_FACEBOOK_THUMBNAIL_RESPONSE);
  }

  const bridgeStatus = Number.isFinite(payload.statusCode) ? Number(payload.statusCode) : undefined;
  if (!response.ok || payload.error || (bridgeStatus !== undefined && bridgeStatus >= 400)) {
    throw new Error(getSafeErrorMessage(payload.error));
  }

  if (!isMediaAsset(payload)) {
    throw new Error(INVALID_FACEBOOK_THUMBNAIL_RESPONSE);
  }

  return payload;
}
