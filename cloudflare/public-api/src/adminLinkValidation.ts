type JsonRecord = Record<string, unknown>;

import { isValidCmsLink, isValidFacebookEmbedPermalink, type CmsLinkKind } from "../../../shared/cmsLinkValidation.ts";

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export { isValidCmsLink, isValidFacebookEmbedPermalink };

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

function validateLeadershipSettings(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.deputies) || value.deputies.length > 4) {
    throw new Error("invalid leadership roster");
  }
  const seconds = value.autoplayIntervalSeconds;
  if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds < 3 || seconds > 30) {
    throw new Error("invalid leadership interval");
  }
  value.deputies.forEach((deputy: unknown, index: number) => {
    if (!isRecord(deputy) || typeof deputy.enabled !== "boolean") {
      throw new Error(`invalid deputy profile ${index + 1}`);
    }
    if (
      deputy.enabled &&
      (typeof deputy.name !== "string" ||
        !deputy.name.trim() ||
        typeof deputy.title !== "string" ||
        !deputy.title.trim())
    ) {
      throw new Error(`incomplete deputy profile ${index + 1}`);
    }
    if (
      typeof deputy.imageUrl !== "string" ||
      (deputy.imageUrl.trim() && !deputy.imageUrl.trim().startsWith("https://"))
    ) {
      throw new Error(`invalid deputy portrait URL ${index + 1}`);
    }
    assertLink(deputy.imageUrl, "resource", `deputy portrait URL ${index + 1}`);
  });
}

const socialIconKeys = new Set([
  "facebook", "school", "computer", "business", "campaign",
  "groups", "calendar", "public", "work", "link", "custom"
]);

function validateHomepageSocialSettings(value: unknown) {
  if (!isRecord(value) || typeof value.enabled !== "boolean" ||
      typeof value.pageEmbedEnabled !== "boolean" ||
      !Number.isInteger(value.pageEmbedHeight) ||
      Number(value.pageEmbedHeight) < 300 ||
      Number(value.pageEmbedHeight) > 800 ||
      !Array.isArray(value.links) || value.links.length > 100) {
    throw new Error("invalid homepage social settings");
  }
  const ids = new Set<string>();
  value.links.forEach((unknownLink, index) => {
    if (!isRecord(unknownLink) ||
        typeof unknownLink.id !== "string" || !unknownLink.id || unknownLink.id.length > 96 ||
        ids.has(unknownLink.id) ||
        (unknownLink.category !== "department" && unknownLink.category !== "unit") ||
        typeof unknownLink.label !== "string" || !unknownLink.label.trim() || unknownLink.label.length > 120 ||
        typeof unknownLink.href !== "string" ||
        !unknownLink.href.trim().startsWith("https://") ||
        typeof unknownLink.iconKey !== "string" || !socialIconKeys.has(unknownLink.iconKey) ||
        typeof unknownLink.iconUrl !== "string" ||
        typeof unknownLink.enabled !== "boolean") {
      throw new Error(`invalid social link ${index + 1}`);
    }
    ids.add(unknownLink.id as string);
    assertLink(unknownLink.href, "navigation", `social link ${index + 1} URL`);
    if (unknownLink.iconKey === "custom" && !unknownLink.iconUrl) {
      throw new Error(`missing social icon ${index + 1}`);
    }
    assertLink(unknownLink.iconUrl, "resource", `social icon ${index + 1} URL`);
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
    if ("leadership" in body) validateLeadershipSettings(body.leadership);
    if ("homepageSocial" in body) validateHomepageSocialSettings(body.homepageSocial);
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

    if (normalizedString(body.template) === "facebook-embed" && !isValidFacebookEmbedPermalink(body.canonicalUrl)) {
      throw new Error("invalid content Facebook embed URL");
    }
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
