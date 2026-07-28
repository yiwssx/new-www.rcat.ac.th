import { normalizeSafeResourceUrl } from "../../utils/safeUrlCore";

const GOOGLE_DRIVE_HOSTS = new Set(["drive.google.com", "www.drive.google.com"]);
const FACEBOOK_CDN_HOST_SUFFIX = "fbcdn.net";
const GOOGLE_DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_PUBLIC_DRIVE_WIDTH = 1600;

export type PublicImageIntent =
  | "logo"
  | "tiny-thumbnail"
  | "content-card"
  | "featured-card"
  | "hero"
  | "portrait"
  | "event-attachment"
  | "content-body"
  | "content-featured"
  | "carousel"
  | "intro-gate";

export interface PublicImageAssetSource {
  type?: string;
  fileId?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  driveUrl?: string;
}

export interface PublicImageIntentPolicy {
  widths: readonly number[];
  fallbackWidth: number;
}

export interface PublicImageSourceSet {
  fileId: string;
  originalUrl: string;
  src: string;
  srcSet: string;
  widths: readonly number[];
}

export const PUBLIC_IMAGE_POLICIES: Readonly<Record<PublicImageIntent, PublicImageIntentPolicy>> = {
  logo: {
    widths: [128],
    fallbackWidth: 128
  },
  "tiny-thumbnail": {
    widths: [160, 240, 320, 480],
    fallbackWidth: 240
  },
  "content-card": {
    widths: [160, 240, 320, 480, 640],
    fallbackWidth: 320
  },
  "featured-card": {
    widths: [320, 480, 640, 900],
    fallbackWidth: 640
  },
  hero: {
    widths: [480, 640, 900, 1200],
    fallbackWidth: 900
  },
  portrait: {
    widths: [192, 256, 384, 512],
    fallbackWidth: 384
  },
  "event-attachment": {
    widths: [320, 480, 640, 900],
    fallbackWidth: 640
  },
  "content-body": {
    widths: [480, 640, 900, 1200, 1600],
    fallbackWidth: 1200
  },
  "content-featured": {
    widths: [480, 640, 900, 1200, 1600],
    fallbackWidth: 1600
  },
  carousel: {
    widths: [480, 640, 900, 1200, 1600],
    fallbackWidth: 1600
  },
  "intro-gate": {
    widths: [480, 640, 900, 1200, 1600],
    fallbackWidth: 1600
  }
};

const SMALL_ASSET_INTENTS = new Set<PublicImageIntent>([
  "logo",
  "tiny-thumbnail",
  "content-card",
  "featured-card",
  "portrait",
  "event-attachment"
]);

export function normalizePublicImageWidths(widths: readonly number[]) {
  return [...new Set(widths)]
    .filter((width) => Number.isInteger(width) && width > 0 && width <= MAX_PUBLIC_DRIVE_WIDTH)
    .sort((left, right) => left - right);
}

export function getPublicImageIntentPolicy(intent: PublicImageIntent): PublicImageIntentPolicy {
  const policy = PUBLIC_IMAGE_POLICIES[intent];
  const widths = normalizePublicImageWidths(policy.widths);
  const fallbackWidth = widths.includes(policy.fallbackWidth) ? policy.fallbackWidth : widths[widths.length - 1] || 0;

  return {
    widths,
    fallbackWidth
  };
}

function isFacebookCdnUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();

    return hostname === FACEBOOK_CDN_HOST_SUFFIX || hostname.endsWith(`.${FACEBOOK_CDN_HOST_SUFFIX}`);
  } catch {
    return false;
  }
}

function isGoogleDriveUrl(value: string) {
  try {
    return GOOGLE_DRIVE_HOSTS.has(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function normalizeGoogleDriveFileId(value: string | null | undefined) {
  const fileId = String(value || "").trim();

  return GOOGLE_DRIVE_FILE_ID_PATTERN.test(fileId) ? fileId : "";
}

export function extractGoogleDriveFileId(value: string | null | undefined) {
  const imageUrl = normalizeSafeResourceUrl(value);

  if (!imageUrl || imageUrl.startsWith("/")) {
    return "";
  }

  try {
    const parsed = new URL(imageUrl);

    if (!GOOGLE_DRIVE_HOSTS.has(parsed.hostname.toLowerCase())) {
      return "";
    }

    const filePathMatch = parsed.pathname.match(/^\/file\/d\/([^/]+)/);
    const fileId = filePathMatch ? filePathMatch[1] : parsed.searchParams.get("id");

    return normalizeGoogleDriveFileId(fileId);
  } catch {
    return "";
  }
}

export function buildGoogleDriveThumbnailUrl(fileId: string, width: number) {
  const safeFileId = normalizeGoogleDriveFileId(fileId);
  const safeWidth = Number.isInteger(width) && width > 0 && width <= MAX_PUBLIC_DRIVE_WIDTH ? width : 0;

  if (!safeFileId || !safeWidth) {
    return "";
  }

  return `https://drive.google.com/thumbnail?id=${safeFileId}&sz=w${safeWidth}`;
}

export function selectPublicImageSource(
  source: string | PublicImageAssetSource | null | undefined,
  intent: PublicImageIntent
) {
  if (typeof source === "string") {
    return source;
  }

  if (!source || (source.type && source.type !== "image")) {
    return "";
  }

  const candidates = SMALL_ASSET_INTENTS.has(intent)
    ? [source.thumbnailUrl, source.previewUrl, source.driveUrl]
    : [source.previewUrl, source.driveUrl, source.thumbnailUrl];

  return candidates.find((candidate) => Boolean(String(candidate || "").trim())) || "";
}

export function resolvePublicImageSource(
  source: string | PublicImageAssetSource | null | undefined,
  intent: PublicImageIntent
): PublicImageSourceSet {
  const originalUrl = normalizeSafeResourceUrl(selectPublicImageSource(source, intent));

  if (!originalUrl || isFacebookCdnUrl(originalUrl)) {
    return {
      fileId: "",
      originalUrl: "",
      src: "",
      srcSet: "",
      widths: []
    };
  }

  if (originalUrl.startsWith("/")) {
    return {
      fileId: "",
      originalUrl,
      src: originalUrl,
      srcSet: "",
      widths: []
    };
  }

  const fileId = extractGoogleDriveFileId(originalUrl);

  if (isGoogleDriveUrl(originalUrl)) {
    if (!fileId) {
      return {
        fileId: "",
        originalUrl: "",
        src: "",
        srcSet: "",
        widths: []
      };
    }

    const policy = getPublicImageIntentPolicy(intent);

    return {
      fileId,
      originalUrl,
      src: buildGoogleDriveThumbnailUrl(fileId, policy.fallbackWidth),
      srcSet: policy.widths.map((width) => `${buildGoogleDriveThumbnailUrl(fileId, width)} ${width}w`).join(", "),
      widths: policy.widths
    };
  }

  return {
    fileId: "",
    originalUrl,
    src: originalUrl,
    srcSet: "",
    widths: []
  };
}

export function normalizePublicImageUrl(
  value: string | null | undefined,
  intent: PublicImageIntent = "content-featured"
) {
  return resolvePublicImageSource(value, intent).src;
}

export function getPublicImageSrcSet(value: string | null | undefined, intent: PublicImageIntent = "content-featured") {
  return resolvePublicImageSource(value, intent).srcSet;
}
