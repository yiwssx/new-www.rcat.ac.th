import type { ContentItem, ContentStatus, ContentType } from "../public-content/types";

const CONTENT_DRAFT_RECOVERY_KEY = "rcat.cms.content-draft.v1";
const CONTENT_DRAFT_RECOVERY_VERSION = 1;
const CONTENT_DRAFT_RECOVERY_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const CONTENT_DRAFT_RECOVERY_MAX_CHARACTERS = 512 * 1024;
const CONTENT_TYPES = new Set<ContentType>(["page", "news", "program", "announcement", "blog"]);
const CONTENT_STATUSES = new Set<ContentStatus>(["draft", "review", "scheduled", "published"]);

export type ContentDraftRecoveryMode = "create" | "edit";

export interface ContentDraftRecovery {
  mode: ContentDraftRecoveryMode;
  ownerUserId: string;
  savedAt: number;
  item: ContentItem;
  tagInputValue: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseRecoverableItem(value: unknown): ContentItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = value.type;
  const status = value.status;

  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.slug !== "string" ||
    !CONTENT_TYPES.has(type as ContentType) ||
    !CONTENT_STATUSES.has(status as ContentStatus) ||
    typeof value.owner !== "string" ||
    typeof value.summary !== "string" ||
    typeof value.updatedAt !== "string" ||
    typeof value.publishAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    title: value.title,
    slug: value.slug,
    type: type as ContentType,
    status: status as ContentStatus,
    owner: value.owner,
    summary: value.summary,
    body: optionalString(value.body),
    category: optionalString(value.category),
    tags: stringList(value.tags),
    seoTitle: optionalString(value.seoTitle),
    seoDescription: optionalString(value.seoDescription),
    canonicalUrl: optionalString(value.canonicalUrl),
    featured: value.featured === true,
    readingMinutes:
      typeof value.readingMinutes === "number" && Number.isFinite(value.readingMinutes)
        ? Math.max(1, value.readingMinutes)
        : 1,
    template: optionalString(value.template) || "standard",
    bodyDocId: optionalString(value.bodyDocId),
    bodyDocUrl: optionalString(value.bodyDocUrl),
    featuredMediaId: optionalString(value.featuredMediaId),
    mediaIds: stringList(value.mediaIds),
    updatedAt: value.updatedAt,
    publishAt: value.publishAt,
    ...(typeof value.revision === "number" && Number.isInteger(value.revision) && value.revision >= 0
      ? { revision: value.revision }
      : {})
  };
}

function getSessionStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function clearContentDraftRecovery() {
  try {
    getSessionStorage()?.removeItem(CONTENT_DRAFT_RECOVERY_KEY);
  } catch {
    // Draft recovery is best effort and must never block the editor.
  }
}

export function readContentDraftRecovery(ownerUserId: string, now = Date.now()): ContentDraftRecovery | null {
  const storage = getSessionStorage();

  if (!storage || !ownerUserId) {
    return null;
  }

  try {
    const serialized = storage.getItem(CONTENT_DRAFT_RECOVERY_KEY);

    if (!serialized || serialized.length > CONTENT_DRAFT_RECOVERY_MAX_CHARACTERS) {
      if (serialized) clearContentDraftRecovery();
      return null;
    }

    const value: unknown = JSON.parse(serialized);

    if (
      !isRecord(value) ||
      value.version !== CONTENT_DRAFT_RECOVERY_VERSION ||
      (value.mode !== "create" && value.mode !== "edit") ||
      typeof value.savedAt !== "number" ||
      !Number.isFinite(value.savedAt) ||
      value.savedAt > now + 60 * 1000 ||
      now - value.savedAt > CONTENT_DRAFT_RECOVERY_MAX_AGE_MS
    ) {
      clearContentDraftRecovery();
      return null;
    }

    if (value.ownerUserId !== ownerUserId) {
      return null;
    }

    const item = parseRecoverableItem(value.item);

    if (!item || (value.mode === "create" ? Boolean(item.id) : !item.id)) {
      clearContentDraftRecovery();
      return null;
    }

    return {
      mode: value.mode,
      ownerUserId,
      savedAt: value.savedAt,
      item,
      tagInputValue: optionalString(value.tagInputValue)
    };
  } catch {
    clearContentDraftRecovery();
    return null;
  }
}

export function writeContentDraftRecovery(input: Omit<ContentDraftRecovery, "savedAt">, now = Date.now()) {
  const storage = getSessionStorage();
  const item = parseRecoverableItem(input.item);

  if (!storage || !input.ownerUserId || !item || (input.mode === "create" ? Boolean(item.id) : !item.id)) {
    return false;
  }

  const serialized = JSON.stringify({
    version: CONTENT_DRAFT_RECOVERY_VERSION,
    ownerUserId: input.ownerUserId,
    mode: input.mode,
    savedAt: now,
    item,
    tagInputValue: input.tagInputValue
  });

  if (serialized.length > CONTENT_DRAFT_RECOVERY_MAX_CHARACTERS) {
    return false;
  }

  try {
    storage.setItem(CONTENT_DRAFT_RECOVERY_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function hasContentDraftRecovery(ownerUserId: string) {
  return readContentDraftRecovery(ownerUserId) !== null;
}
