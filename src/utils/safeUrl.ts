const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const GOOGLE_DRIVE_IMAGE_SIZE = "w1600";
const GOOGLE_DRIVE_HOSTS = new Set(["drive.google.com", "www.drive.google.com"]);
const FACEBOOK_CDN_HOST_SUFFIX = "fbcdn.net";
const GOOGLE_DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function hasUnsafeUrlCharacter(value: string) {
  for (const char of value) {
    const code = char.charCodeAt(0);

    if (code <= 31 || code === 127 || char === "\\" || /\s/.test(char)) {
      return true;
    }
  }

  return false;
}

export function normalizeSafeHref(value: string): string {
  const href = String(value || "").trim();

  if (!href) {
    return "#";
  }

  if (hasUnsafeUrlCharacter(href)) {
    return "#";
  }

  if (href.startsWith("#")) {
    return href;
  }

  if (href.startsWith("/")) {
    return href.startsWith("//") ? "#" : href;
  }

  const protocolMatch = href.match(/^([a-zA-Z][a-zA-Z\d+.-]*):/);

  if (!protocolMatch) {
    return "#";
  }

  const protocol = `${protocolMatch[1].toLowerCase()}:`;

  return ALLOWED_PROTOCOLS.has(protocol) ? href : "#";
}

export function normalizeSafeResourceUrl(value: string | null | undefined): string {
  const href = normalizeSafeHref(value || "");

  if (href === "#") {
    return "";
  }

  const lowerHref = href.toLowerCase();

  if (href.startsWith("/") || lowerHref.startsWith("https://")) {
    return href;
  }

  return "";
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

function normalizeGoogleDriveFileId(value: string | null) {
  const fileId = String(value || "").trim();

  return GOOGLE_DRIVE_FILE_ID_PATTERN.test(fileId) ? fileId : "";
}

function extractGoogleDriveFileId(value: string) {
  try {
    const parsed = new URL(value);

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

export function normalizePublicImageUrl(value: string | null | undefined): string {
  const imageUrl = normalizeSafeResourceUrl(value);

  if (!imageUrl) {
    return "";
  }

  if (imageUrl.startsWith("/")) {
    return imageUrl;
  }

  if (isFacebookCdnUrl(imageUrl)) {
    return "";
  }

  const googleDriveFileId = extractGoogleDriveFileId(imageUrl);

  if (isGoogleDriveUrl(imageUrl)) {
    return googleDriveFileId
      ? `https://drive.google.com/thumbnail?id=${googleDriveFileId}&sz=${GOOGLE_DRIVE_IMAGE_SIZE}`
      : "";
  }

  return imageUrl;
}
