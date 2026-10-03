import { isValidCmsLink, isValidFacebookEmbedPermalink } from "./adminLinkValidation.ts";
import type { ContentRow, DocumentRow, MediaAssetRow, MenuItemRow } from "./db/schema";

const CONTENT_TYPES = new Set(["page", "news", "program", "announcement", "blog"]);
const CONTENT_STATUSES = new Set(["draft", "review", "scheduled", "published"]);
const PUBLISHABLE_CONTENT_STATUSES = new Set(["scheduled", "published"]);
const INTENTIONAL_NAVIGATION_PLACEHOLDERS = new Set(["#", "/", "/#"]);

export type ContentIntegrityEntity = "content" | "document" | "menu";

export type ContentIntegrityIssueCode =
  | "content-slug-duplicate"
  | "content-status-invalid"
  | "content-type-invalid"
  | "content-required-field-missing"
  | "content-publish-at-invalid"
  | "content-publish-at-future"
  | "content-inactive-future-publish-at"
  | "content-facebook-permalink-invalid"
  | "content-document-reference-incomplete"
  | "content-document-url-invalid"
  | "content-media-reference-invalid"
  | "content-media-reference-missing"
  | "document-required-field-missing"
  | "document-file-url-invalid"
  | "document-media-reference-missing"
  | "menu-href-invalid"
  | "menu-parent-missing"
  | "menu-parent-self-reference"
  | "menu-parent-cycle"
  | "menu-content-reference-missing"
  | "menu-content-reference-not-public";

export interface ContentIntegrityIssue {
  code: ContentIntegrityIssueCode;
  entity: ContentIntegrityEntity;
  id: string;
  field?: string;
}

export interface ContentIntegritySnapshot {
  now: string;
  contents: readonly ContentRow[];
  documents?: readonly DocumentRow[];
  mediaAssets?: readonly Pick<MediaAssetRow, "id">[];
  menuItems?: readonly MenuItemRow[];
}

export interface ContentIntegrityResult {
  ok: boolean;
  checked: {
    contents: number;
    documents: number;
    mediaAssets: number;
    menuItems: number;
  };
  issues: ContentIntegrityIssue[];
}

function normalizedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isDeleted(value: unknown) {
  return Boolean(normalizedString(value));
}

function normalizedSlug(value: unknown) {
  return normalizedString(value).normalize("NFKC").toLowerCase();
}

function timestampMillis(value: unknown) {
  const timestamp = normalizedString(value);

  if (!timestamp) {
    return null;
  }

  const millis = Date.parse(timestamp);
  return Number.isFinite(millis) ? millis : null;
}

function issue(
  issues: ContentIntegrityIssue[],
  code: ContentIntegrityIssueCode,
  entity: ContentIntegrityEntity,
  id: string,
  field?: string
) {
  issues.push({ code, entity, id: normalizedString(id) || "unknown", ...(field ? { field } : {}) });
}

function parseReferenceArray(value: unknown) {
  if (typeof value !== "string") {
    return { valid: false, values: [] as string[] };
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      return { valid: false, values: [] as string[] };
    }

    return {
      valid: true,
      values: [...new Set(parsed.map((item) => item.trim()).filter(Boolean))]
    };
  } catch {
    return { valid: false, values: [] as string[] };
  }
}

function getContentSlugFromMenuHref(value: unknown) {
  const href = normalizedString(value);

  if (!href || INTENTIONAL_NAVIGATION_PLACEHOLDERS.has(href) || !href.startsWith("/content/")) {
    return null;
  }

  try {
    const url = new URL(href, "https://integrity.invalid");
    const segments = url.pathname.split("/").filter(Boolean);

    if (segments.length !== 2 || segments[0] !== "content") {
      return null;
    }

    return normalizedSlug(decodeURIComponent(segments[1] ?? "")) || null;
  } catch {
    return null;
  }
}

function isContentPublicAt(row: ContentRow, nowMillis: number) {
  const publishAtMillis = timestampMillis(row.publish_at);

  if (publishAtMillis === null || publishAtMillis > nowMillis) {
    return false;
  }

  return row.status === "published" || row.status === "scheduled";
}

function auditContentRows(
  rows: readonly ContentRow[],
  mediaIds: ReadonlySet<string>,
  nowMillis: number,
  issues: ContentIntegrityIssue[]
) {
  const activeRows = rows.filter((row) => !isDeleted(row.deleted_at));
  const slugGroups = new Map<string, ContentRow[]>();

  for (const row of activeRows) {
    const slug = normalizedSlug(row.slug);

    if (slug) {
      const group = slugGroups.get(slug) ?? [];
      group.push(row);
      slugGroups.set(slug, group);
    }
  }

  for (const group of slugGroups.values()) {
    if (group.length < 2) {
      continue;
    }

    for (const row of group) {
      issue(issues, "content-slug-duplicate", "content", row.id, "slug");
    }
  }

  for (const row of activeRows) {
    const status = normalizedString(row.status);
    const type = normalizedString(row.type);
    const publishAt = normalizedString(row.publish_at);
    const publishAtMillis = timestampMillis(publishAt);

    if (!CONTENT_STATUSES.has(status)) {
      issue(issues, "content-status-invalid", "content", row.id, "status");
    }

    if (!CONTENT_TYPES.has(type)) {
      issue(issues, "content-type-invalid", "content", row.id, "type");
    }

    if (PUBLISHABLE_CONTENT_STATUSES.has(status)) {
      for (const [field, value] of [
        ["slug", row.slug],
        ["type", row.type],
        ["owner", row.owner],
        ["title", row.title]
      ] as const) {
        if (!normalizedString(value)) {
          issue(issues, "content-required-field-missing", "content", row.id, field);
        }
      }
    }

    if (status === "published") {
      if (publishAtMillis === null) {
        issue(issues, "content-publish-at-invalid", "content", row.id, "publish_at");
      } else if (publishAtMillis > nowMillis) {
        issue(issues, "content-publish-at-future", "content", row.id, "publish_at");
      }
    } else if (status === "scheduled") {
      if (publishAtMillis === null) {
        issue(issues, "content-publish-at-invalid", "content", row.id, "publish_at");
      }
    } else if ((status === "draft" || status === "review") && publishAt) {
      if (publishAtMillis === null) {
        issue(issues, "content-publish-at-invalid", "content", row.id, "publish_at");
      } else if (publishAtMillis > nowMillis) {
        issue(issues, "content-inactive-future-publish-at", "content", row.id, "publish_at");
      }
    }

    if (normalizedString(row.template) === "facebook-embed" && !isValidFacebookEmbedPermalink(row.canonical_url)) {
      issue(issues, "content-facebook-permalink-invalid", "content", row.id, "canonical_url");
    }

    const bodyDocumentId = normalizedString(row.body_doc_id);
    const bodyDocumentUrl = normalizedString(row.body_doc_url);

    if (Boolean(bodyDocumentId) !== Boolean(bodyDocumentUrl)) {
      issue(issues, "content-document-reference-incomplete", "content", row.id, "body_doc_id");
    }

    if (bodyDocumentUrl && !isValidCmsLink(bodyDocumentUrl, "resource", false)) {
      issue(issues, "content-document-url-invalid", "content", row.id, "body_doc_url");
    }

    const featuredMediaId = normalizedString(row.featured_media_id);

    if (featuredMediaId && !mediaIds.has(featuredMediaId)) {
      issue(issues, "content-media-reference-missing", "content", row.id, "featured_media_id");
    }

    const mediaReferences = parseReferenceArray(row.media_ids_json);

    if (!mediaReferences.valid) {
      issue(issues, "content-media-reference-invalid", "content", row.id, "media_ids_json");
    } else {
      for (const mediaId of mediaReferences.values) {
        if (!mediaIds.has(mediaId)) {
          issue(issues, "content-media-reference-missing", "content", row.id, "media_ids_json");
        }
      }
    }
  }

  return activeRows;
}

function auditDocumentRows(
  rows: readonly DocumentRow[],
  mediaIds: ReadonlySet<string>,
  issues: ContentIntegrityIssue[]
) {
  const activeRows = rows.filter((row) => !isDeleted(row.deleted_at));

  for (const row of activeRows) {
    if (row.status === "published") {
      for (const [field, value] of [
        ["title", row.title],
        ["file_url", row.file_url]
      ] as const) {
        if (!normalizedString(value)) {
          issue(issues, "document-required-field-missing", "document", row.id, field);
        }
      }
    }

    if (normalizedString(row.file_url) && !isValidCmsLink(row.file_url, "resource", false)) {
      issue(issues, "document-file-url-invalid", "document", row.id, "file_url");
    }

    const mediaId = normalizedString(row.media_id);

    if (mediaId && !mediaIds.has(mediaId)) {
      issue(issues, "document-media-reference-missing", "document", row.id, "media_id");
    }
  }

  return activeRows;
}

function auditMenuRows(
  rows: readonly MenuItemRow[],
  activeContents: readonly ContentRow[],
  nowMillis: number,
  issues: ContentIntegrityIssue[]
) {
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const contentBySlug = new Map<string, ContentRow[]>();

  for (const content of activeContents) {
    const slug = normalizedSlug(content.slug);
    if (!slug) continue;
    const values = contentBySlug.get(slug) ?? [];
    values.push(content);
    contentBySlug.set(slug, values);
  }

  for (const row of rows) {
    const parentId = normalizedString(row.parent_id);
    const href = normalizedString(row.href);

    if (!isValidCmsLink(href, "navigation", false)) {
      issue(issues, "menu-href-invalid", "menu", row.id, "href");
    }

    if (parentId === row.id) {
      issue(issues, "menu-parent-self-reference", "menu", row.id, "parent_id");
    } else if (parentId && !rowById.has(parentId)) {
      issue(issues, "menu-parent-missing", "menu", row.id, "parent_id");
    }

    if (row.enabled !== 1) {
      continue;
    }

    const contentSlug = getContentSlugFromMenuHref(href);

    if (!contentSlug) {
      continue;
    }

    const referenced = contentBySlug.get(contentSlug) ?? [];

    if (referenced.length === 0) {
      issue(issues, "menu-content-reference-missing", "menu", row.id, "href");
    } else if (!referenced.some((content) => isContentPublicAt(content, nowMillis))) {
      issue(issues, "menu-content-reference-not-public", "menu", row.id, "href");
    }
  }

  const cycleIds = new Set<string>();

  for (const row of rows) {
    const path: string[] = [];
    const seenAt = new Map<string, number>();
    let current: MenuItemRow | undefined = row;

    while (current) {
      const currentId = current.id;
      const existingIndex = seenAt.get(currentId);

      if (existingIndex !== undefined) {
        for (const id of path.slice(existingIndex)) {
          cycleIds.add(id);
        }
        break;
      }

      seenAt.set(currentId, path.length);
      path.push(currentId);
      const parentId = normalizedString(current.parent_id);
      current = parentId ? rowById.get(parentId) : undefined;
    }
  }

  for (const id of [...cycleIds].sort()) {
    if (rowById.get(id)?.parent_id === id) {
      continue;
    }
    issue(issues, "menu-parent-cycle", "menu", id, "parent_id");
  }
}

function compareIssues(left: ContentIntegrityIssue, right: ContentIntegrityIssue) {
  return (
    left.entity.localeCompare(right.entity) ||
    left.id.localeCompare(right.id) ||
    left.code.localeCompare(right.code) ||
    (left.field ?? "").localeCompare(right.field ?? "")
  );
}

export function auditContentIntegrity(snapshot: ContentIntegritySnapshot): ContentIntegrityResult {
  const nowMillis = timestampMillis(snapshot.now);

  if (nowMillis === null) {
    throw new Error("content integrity audit requires a valid now timestamp");
  }

  const documents = snapshot.documents ?? [];
  const mediaAssets = snapshot.mediaAssets ?? [];
  const menuItems = snapshot.menuItems ?? [];
  const mediaIds = new Set(mediaAssets.map((row) => normalizedString(row.id)).filter(Boolean));
  const issues: ContentIntegrityIssue[] = [];
  const activeContents = auditContentRows(snapshot.contents, mediaIds, nowMillis, issues);
  auditDocumentRows(documents, mediaIds, issues);
  auditMenuRows(menuItems, activeContents, nowMillis, issues);
  issues.sort(compareIssues);

  return {
    ok: issues.length === 0,
    checked: {
      contents: snapshot.contents.length,
      documents: documents.length,
      mediaAssets: mediaAssets.length,
      menuItems: menuItems.length
    },
    issues
  };
}
