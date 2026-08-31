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
const FACEBOOK_THUMBNAIL_UNAVAILABLE = "Unable to create Facebook thumbnail";
const FACEBOOK_PUBLIC_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com"]);
const FACEBOOK_LEGACY_POST_PATH = /^\/(\d+)\/posts\/(\d+)\/?$/;

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

function createLegacyFacebookPermalinkCandidates(parsed: URL) {
  const match = parsed.pathname.match(FACEBOOK_LEGACY_POST_PATH);
  if (!match) {
    return [];
  }

  const [, pageId, postId] = match;
  if (!pageId || !postId) {
    return [];
  }

  return ["www.facebook.com", "m.facebook.com"].map((hostname) => {
    const legacyUrl = new URL("https://www.facebook.com/permalink.php");
    legacyUrl.hostname = hostname;
    legacyUrl.searchParams.set("story_fbid", postId);
    legacyUrl.searchParams.set("id", pageId);
    return legacyUrl.toString();
  });
}

function createFacebookSourceCandidates(sourceUrl: string) {
  const candidates = [sourceUrl];

  try {
    const parsed = new URL(sourceUrl);
    const hostname = parsed.hostname.toLowerCase();

    if (!FACEBOOK_PUBLIC_HOSTS.has(hostname)) {
      return candidates;
    }

    const fallbackHostname = hostname === "m.facebook.com" ? "www.facebook.com" : "m.facebook.com";
    parsed.hostname = fallbackHostname;
    candidates.push(parsed.toString());
    candidates.push(...createLegacyFacebookPermalinkCandidates(parsed));
  } catch {
    // The server proxy remains responsible for validating malformed source URLs.
  }

  return [...new Set(candidates)];
}

function isRetryablePreviewFailure(response: Response, payload: BridgeEnvelope) {
  const bridgeStatus = Number.isFinite(payload.statusCode) ? Number(payload.statusCode) : undefined;
  const status = bridgeStatus ?? response.status;

  return status === 422 && getSafeErrorMessage(payload.error) === FACEBOOK_THUMBNAIL_UNAVAILABLE;
}

async function requestFacebookThumbnail(input: FacebookThumbnailImportInput, csrfToken: string) {
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
    throw new CmsAuthError(401, { message: CMS_SESSION_EXPIRED_MESSAGE });
  }

  let payload: BridgeEnvelope;
  try {
    payload = (await response.json()) as BridgeEnvelope;
  } catch {
    throw new Error(INVALID_FACEBOOK_THUMBNAIL_RESPONSE);
  }

  return { payload, response };
}

export async function importFacebookThumbnailFromBridge(input: FacebookThumbnailImportInput): Promise<MediaAsset> {
  const csrfToken = readCmsCsrfToken();

  if (!csrfToken) {
    throw new CmsAuthError(403);
  }

  const sourceCandidates = createFacebookSourceCandidates(input.sourceUrl);
  let lastPreviewError: Error | undefined;

  for (const [index, sourceUrl] of sourceCandidates.entries()) {
    const { payload, response } = await requestFacebookThumbnail({ ...input, sourceUrl }, csrfToken);
    const bridgeStatus = Number.isFinite(payload.statusCode) ? Number(payload.statusCode) : undefined;

    if (!response.ok || payload.error || (bridgeStatus !== undefined && bridgeStatus >= 400)) {
      const error = new Error(getSafeErrorMessage(payload.error));
      const hasFallback = index < sourceCandidates.length - 1;

      if (hasFallback && isRetryablePreviewFailure(response, payload)) {
        lastPreviewError = error;
        continue;
      }

      throw error;
    }

    if (!isMediaAsset(payload)) {
      throw new Error(INVALID_FACEBOOK_THUMBNAIL_RESPONSE);
    }

    return payload;
  }

  throw lastPreviewError ?? new Error(INVALID_FACEBOOK_THUMBNAIL_RESPONSE);
}
