type JsonRecord = Record<string, unknown>;

type CmsLinkKind = "canonical" | "navigation" | "resource";

const MAX_LINK_LENGTH = 4_096;
const NAVIGATION_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const CANONICAL_PROTOCOLS = new Set(["http:", "https:"]);
const RESOURCE_PROTOCOLS = new Set(["https:"]);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hasUnsafeCharacter(value: string) {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;

    if (codePoint <= 31 || codePoint === 127 || character === "\\" || /\s/u.test(character)) {
      return true;
    }
  }

  return false;
}

function absoluteProtocol(value: string) {
  const match = value.match(/^([a-zA-Z][a-zA-Z\d+.-]*):/u);
  return match ? `${match[1].toLowerCase()}:` : "";
}

function isValidAbsoluteUrl(value: string, allowedProtocols: Set<string>) {
  const protocol = absoluteProtocol(value);

  if (!protocol || !allowedProtocols.has(protocol)) {
    return false;
  }

  if (protocol === "mailto:" || protocol === "tel:") {
    return value.slice(protocol.length).length > 0;
  }

  try {
    const url = new URL(value);
    return allowedProtocols.has(url.protocol.toLowerCase()) && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isValidCmsLink(value: unknown, kind: CmsLinkKind, allowEmpty = true) {
  const link = normalizedString(value);

  if (!link) {
    return allowEmpty;
  }

  if (link.length > MAX_LINK_LENGTH || hasUnsafeCharacter(link)) {
    return false;
  }

  if (kind === "navigation" && link.startsWith("#")) {
    return true;
  }

  if (link.startsWith("/")) {
    return kind !== "canonical" && !link.startsWith("//");
  }

  if (kind === "canonical") {
    return isValidAbsoluteUrl(link, CANONICAL_PROTOCOLS);
  }

  return isValidAbsoluteUrl(link, kind === "navigation" ? NAVIGATION_PROTOCOLS : RESOURCE_PROTOCOLS);
}

function assertLink(value: unknown, kind: CmsLinkKind, field: string) {
  if (value === undefined || value === null) {
    return;
  }

  if (!isValidCmsLink(value, kind, true)) {
    throw new Error(`invalid ${field}`);
  }
}

function validateFooterDirectoryGroups(value: unknown) {
  if (!Array.isArray(value)) {
    return;
  }

  value.forEach((group) => {
    if (!isRecord(group) || !Array.isArray(group.links)) {
      return;
    }

    group.links.forEach((link) => {
      if (isRecord(link)) {
        assertLink(link.href, "navigation", "site footer link href");
      }
    });
  });
}

function validateSettingsBody(kind: string, body: JsonRecord) {
  if (kind === "site") {
    ["admissionUrl", "facebookUrl", "youtubeUrl", "tiktokUrl", "messengerUrl", "mapUrl"].forEach((field) => {
      if (field in body) {
        assertLink(body[field], "navigation", `site settings ${field}`);
      }
    });
    ["heroImageUrl", "directorImageUrl", "mapEmbedUrl"].forEach((field) => {
      if (field in body) {
        assertLink(body[field], "resource", `site settings ${field}`);
      }
    });
    validateFooterDirectoryGroups(body.footerDirectoryGroups);
    return;
  }

  if (kind !== "homepage") {
    return;
  }

  if (isRecord(body.introGate)) {
    assertLink(body.introGate.imageUrl, "resource", "homepage intro image URL");
    assertLink(body.introGate.secondaryButtonUrl, "navigation", "homepage intro secondary button URL");
  }

  if (isRecord(body.introVideo)) {
    assertLink(body.introVideo.youtubeEmbedUrl, "resource", "homepage intro video URL");
  }
}

function validateMenuItem(value: unknown) {
  if (!isRecord(value)) {
    return;
  }

  assertLink(value.href, "navigation", "menu href");

  if (Array.isArray(value.children)) {
    value.children.forEach(validateMenuItem);
  }
}

function validateEntityBody(entity: string, body: JsonRecord) {
  if (entity === "content") {
    assertLink(body.canonicalUrl, "canonical", "content canonical URL");
    assertLink(body.bodyDocUrl, "resource", "content body document URL");
    return;
  }

  if (entity === "documents") {
    assertLink(body.fileUrl, "resource", "document file URL");
    return;
  }

  if (entity === "home-sections") {
    assertLink(body.href, "navigation", "home section href");
    return;
  }

  if (entity === "carousel") {
    assertLink(body.imageUrl, "resource", "carousel image URL");
    assertLink(body.mobileImageUrl, "resource", "carousel mobile image URL");
    assertLink(body.href, "navigation", "carousel href");
    return;
  }

  if (entity === "external-services") {
    assertLink(body.href, "navigation", "external service href");
    return;
  }

  if (entity === "media") {
    assertLink(body.driveUrl, "resource", "media Drive URL");
    assertLink(body.previewUrl, "resource", "media preview URL");
    assertLink(body.embedUrl, "resource", "media embed URL");
    assertLink(body.thumbnailUrl, "resource", "media thumbnail URL");
  }
}

function shouldInspectBody(method: string) {
  return method === "POST" || method === "PATCH" || method === "PUT";
}

export async function validateAdminLinkWriteRequest(request: Request) {
  if (!shouldInspectBody(request.method)) {
    return;
  }

  const { pathname } = new URL(request.url);

  if (!pathname.startsWith("/api/admin/")) {
    return;
  }

  const segments = pathname.slice("/api/admin/".length).split("/").filter(Boolean);
  const entity = segments[0] ?? "";

  if (!entity || segments[1] === "order" || entity === "media-bridge-authorization") {
    return;
  }

  let parsed: unknown;

  try {
    parsed = await request.clone().json();
  } catch {
    // The existing route handler owns malformed-JSON error semantics.
    return;
  }

  if (!isRecord(parsed)) {
    return;
  }

  if (entity === "settings" && segments.length === 2) {
    validateSettingsBody(segments[1] ?? "", parsed);
    return;
  }

  if (entity === "menu") {
    if (Array.isArray(parsed.items)) {
      parsed.items.forEach(validateMenuItem);
    } else {
      validateMenuItem(parsed);
    }
    return;
  }

  if (entity === "external-services" && Array.isArray(parsed.items)) {
    parsed.items.forEach((item) => {
      if (isRecord(item)) {
        validateEntityBody(entity, item);
      }
    });
    return;
  }

  validateEntityBody(entity, parsed);
}
