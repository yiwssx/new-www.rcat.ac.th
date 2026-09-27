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
  logo: { widths: [128], fallbackWidth: 128 },
  "tiny-thumbnail": { widths: [160, 240, 320, 480], fallbackWidth: 240 },
  "content-card": { widths: [160, 240, 320, 480, 640], fallbackWidth: 320 },
  "featured-card": { widths: [320, 480, 640, 900], fallbackWidth: 640 },
  hero: { widths: [480, 640, 900, 1200], fallbackWidth: 900 },
  portrait: { widths: [192, 256, 384, 512], fallbackWidth: 384 },
  "event-attachment": { widths: [320, 480, 640, 900], fallbackWidth: 640 },
  "content-body": { widths: [480, 640, 900, 1200, 1600], fallbackWidth: 1200 },
  "content-featured": { widths: [480, 640, 900, 1200, 1600], fallbackWidth: 1600 },
  carousel: { widths: [480, 640, 900, 1200, 1600], fallbackWidth: 1600 },
  "intro-gate": { widths: [480, 640, 900, 1200, 1600], fallbackWidth: 1600 }
};

const PUBLIC_IMAGE_INTENTS = new Set<PublicImageIntent>(Object.keys(PUBLIC_IMAGE_POLICIES) as PublicImageIntent[]);
const SMALL_ASSET_INTENTS = new Set<PublicImageIntent>([
  "logo",
  "tiny-thumbnail",
  "content-card",
  "featured-card",
  "portrait",
  "event-attachment"
]);

function normalizePublicImageDeliveryBaseUrl(value: string | null | undefined) {
  const input = String(value || "").trim();
  if (!input) return "";

  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "https:") return "";
    parsed.search = "";
    parsed.hash = "";
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function getConfiguredPublicImageDeliveryBaseUrl() {
  return normalizePublicImageDeliveryBaseUrl(import.meta.env.VITE_PUBLIC_IMAGE_DELIVERY_BASE_URL);
}

export function getConfiguredPublicImageDeliveryIntents() {
  const rawValue = String(import.meta.env.VITE_PUBLIC_IMAGE_DELIVERY_INTENTS || "")
    .trim()
    .toLowerCase();

  if (!rawValue) return new Set<PublicImageIntent>();
  if (rawValue === "*") return new Set(PUBLIC_IMAGE_INTENTS);

  return new Set(
    rawValue
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is PublicImageIntent => PUBLIC_IMAGE_INTENTS.has(value as PublicImageIntent))
  );
}

export function isPublicImageDeliveryEnabled(intent: PublicImageIntent) {
  return Boolean(getConfiguredPublicImageDeliveryBaseUrl()) && getConfiguredPublicImageDeliveryIntents().has(intent);
}

export function normalizePublicImageWidths(widths: readonly number[]) {
  return [...new Set(widths)]
    .filter((width) => Number.isInteger(width) && width > 0 && width <= MAX_PUBLIC_DRIVE_WIDTH)
    .sort((left, right) => left - right);
}

export function getPublicImageIntentPolicy(intent: PublicImageIntent): PublicImageIntentPolicy {
  const policy = PUBLIC_IMAGE_POLICIES[intent];
  const widths = normalizePublicImageWidths(policy.widths);
  const fallbackWidth = widths.includes(policy.fallbackWidth) ? policy.fallbackWidth : widths[widths.length - 1] || 0;
  return { widths, fallbackWidth };
}

function normalizeGoogleDriveFileId(value: string | null | undefined) {
  const fileId = String(value || "").trim();
  return GOOGLE_DRIVE_FILE_ID_PATTERN.test(fileId) ? fileId : "";
}

function extractGoogleDriveFileIdFromUrl(parsedUrl: URL) {
  if (!GOOGLE_DRIVE_HOSTS.has(parsedUrl.hostname.toLowerCase())) return "";
  const filePathMatch = parsedUrl.pathname.match(/^\/file\/d\/([^/]+)/);
  const fileId = filePathMatch ? filePathMatch[1] : parsedUrl.searchParams.get("id");
  return normalizeGoogleDriveFileId(fileId);
}

export function extractGoogleDriveFileId(value: string | null | undefined) {
  const imageUrl = normalizeSafeResourceUrl(value);
  if (!imageUrl || imageUrl.startsWith("/")) return "";
  try {
    return extractGoogleDriveFileIdFromUrl(new URL(imageUrl));
  } catch {
    return "";
  }
}

export function buildGoogleDriveThumbnailUrl(fileId: string, width: number) {
  const safeFileId = normalizeGoogleDriveFileId(fileId);
  const safeWidth = Number.isInteger(width) && width > 0 && width <= MAX_PUBLIC_DRIVE_WIDTH ? width : 0;
  if (!safeFileId || !safeWidth) return "";
  return `https://drive.google.com/thumbnail?id=${safeFileId}&sz=w${safeWidth}`;
}

export function buildPublicImageDeliveryUrl(
  fileId: string,
  width: number,
  baseUrl: string = getConfiguredPublicImageDeliveryBaseUrl()
) {
  const safeFileId = normalizeGoogleDriveFileId(fileId);
  const safeWidth = Number.isInteger(width) && width > 0 && width <= MAX_PUBLIC_DRIVE_WIDTH ? width : 0;
  const safeBaseUrl = normalizePublicImageDeliveryBaseUrl(baseUrl);
  if (!safeFileId || !safeWidth || !safeBaseUrl) return "";
  return `${safeBaseUrl}/image/${encodeURIComponent(safeFileId)}?w=${safeWidth}`;
}

function createEmptyPublicImageSource(): PublicImageSourceSet {
  return { fileId: "", originalUrl: "", src: "", srcSet: "", widths: [] };
}

function getPublicImageCandidates(
  source: string | PublicImageAssetSource | null | undefined,
  intent: PublicImageIntent
) {
  if (typeof source === "string") return [source];
  if (!source || (source.type && source.type !== "image")) return [];
  return SMALL_ASSET_INTENTS.has(intent)
    ? [source.thumbnailUrl, source.previewUrl, source.driveUrl]
    : [source.previewUrl, source.driveUrl, source.thumbnailUrl];
}

function createGoogleDriveSource(fileId: string, originalUrl: string, intent: PublicImageIntent, useDelivery: boolean) {
  const policy = getPublicImageIntentPolicy(intent);
  const deliveryEnabled = useDelivery && isPublicImageDeliveryEnabled(intent);
  const buildVariantUrl = deliveryEnabled ? buildPublicImageDeliveryUrl : buildGoogleDriveThumbnailUrl;
  return {
    fileId,
    originalUrl,
    src: buildVariantUrl(fileId, policy.fallbackWidth),
    srcSet: policy.widths.map((width) => `${buildVariantUrl(fileId, width)} ${width}w`).join(", "),
    widths: policy.widths
  } satisfies PublicImageSourceSet;
}

function resolvePublicImageCandidate(
  candidate: string | null | undefined,
  intent: PublicImageIntent,
  useDelivery = true
): PublicImageSourceSet | null {
  const originalUrl = normalizeSafeResourceUrl(candidate);
  if (!originalUrl) return null;

  if (originalUrl.startsWith("/")) {
    return { fileId: "", originalUrl, src: originalUrl, srcSet: "", widths: [] };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(originalUrl);
  } catch {
    return null;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname === FACEBOOK_CDN_HOST_SUFFIX || hostname.endsWith(`.${FACEBOOK_CDN_HOST_SUFFIX}`)) return null;

  if (GOOGLE_DRIVE_HOSTS.has(hostname)) {
    const fileId = extractGoogleDriveFileIdFromUrl(parsedUrl);
    if (!fileId) return null;
    return createGoogleDriveSource(fileId, originalUrl, intent, useDelivery);
  }

  return { fileId: "", originalUrl, src: originalUrl, srcSet: "", widths: [] };
}

function resolveFromCandidates(
  source: string | PublicImageAssetSource | null | undefined,
  intent: PublicImageIntent,
  useDelivery: boolean
) {
  for (const candidate of getPublicImageCandidates(source, intent)) {
    const resolvedCandidate = resolvePublicImageCandidate(candidate, intent, useDelivery);
    if (resolvedCandidate) return resolvedCandidate;
  }
  return createEmptyPublicImageSource();
}

export function selectPublicImageSource(
  source: string | PublicImageAssetSource | null | undefined,
  intent: PublicImageIntent
) {
  return resolveFromCandidates(source, intent, false).originalUrl;
}

export function resolvePublicImageSource(
  source: string | PublicImageAssetSource | null | undefined,
  intent: PublicImageIntent
): PublicImageSourceSet {
  return resolveFromCandidates(source, intent, true);
}

export function resolvePublicImageFallbackSource(
  source: string | PublicImageAssetSource | null | undefined,
  intent: PublicImageIntent
): PublicImageSourceSet {
  if (!isPublicImageDeliveryEnabled(intent)) return createEmptyPublicImageSource();
  const fallback = resolveFromCandidates(source, intent, false);
  return fallback.fileId ? fallback : createEmptyPublicImageSource();
}

export function getPublicImageDeliveryVariantUrls(
  source: string | PublicImageAssetSource | null | undefined,
  intent: PublicImageIntent
) {
  if (!isPublicImageDeliveryEnabled(intent)) return [];
  const resolved = resolvePublicImageSource(source, intent);
  if (!resolved.fileId) return [];
  return resolved.widths
    .map((width) => buildPublicImageDeliveryUrl(resolved.fileId, width))
    .filter((url): url is string => Boolean(url));
}

// Storage/admin normalization is deliberately delivery-neutral. Worker routing is a render-time concern.
export function normalizePublicImageUrl(
  value: string | null | undefined,
  intent: PublicImageIntent = "content-featured"
) {
  return resolveFromCandidates(value, intent, false).src;
}

export function getPublicImageSrcSet(value: string | null | undefined, intent: PublicImageIntent = "content-featured") {
  return resolveFromCandidates(value, intent, false).srcSet;
}
