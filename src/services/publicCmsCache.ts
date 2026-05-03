import { CmsSnapshot, ContentItem } from "../types";

export const PUBLIC_SNAPSHOT_CACHE_KEY = "rcat.cms.public.snapshot.v1";
export const PUBLIC_CONTENT_DETAIL_CACHE_PREFIX = "rcat.cms.public.content-detail.v1.";
export const PUBLIC_SNAPSHOT_CACHE_TTL_MS = 15 * 60 * 1000;
export const PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS = 30 * 60 * 1000;

const maxContentDetailCacheEntries = 20;

export type CacheEntry<T> = {
  data: T;
  savedAt: number;
  expiresAt: number;
};

function getPublicStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isCacheEntry(value: unknown): value is CacheEntry<unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const entry = value as Partial<CacheEntry<unknown>>;
  return typeof entry.savedAt === "number" && typeof entry.expiresAt === "number" && "data" in entry;
}

function getPublicContentDetailCacheKey(slug: string) {
  return `${PUBLIC_CONTENT_DETAIL_CACHE_PREFIX}${encodeURIComponent(slug)}`;
}

function getKeysByPrefix(prefix: string) {
  const storage = getPublicStorage();

  if (!storage) {
    return [];
  }

  const keys: string[] = [];

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (key?.startsWith(prefix)) {
        keys.push(key);
      }
    }
  } catch {
    return [];
  }

  return keys;
}

function cleanupPublicContentDetailCache(maxEntries = maxContentDetailCacheEntries) {
  const entries = getKeysByPrefix(PUBLIC_CONTENT_DETAIL_CACHE_PREFIX)
    .map((key) => {
      const cached = readPublicCache<unknown>(key);
      return cached ? { key, savedAt: cached.savedAt } : null;
    })
    .filter((entry): entry is { key: string; savedAt: number } => Boolean(entry))
    .sort((left, right) => right.savedAt - left.savedAt);

  entries.slice(maxEntries).forEach((entry) => {
    removePublicCache(entry.key);
  });
}

export function readPublicCache<T>(key: string): { data: T; savedAt: number } | null {
  const storage = getPublicStorage();

  if (!storage) {
    return null;
  }

  let raw: string | null;

  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    removePublicCache(key);
    return null;
  }

  if (!isCacheEntry(parsed)) {
    removePublicCache(key);
    return null;
  }

  if (parsed.expiresAt <= Date.now()) {
    removePublicCache(key);
    return null;
  }

  return {
    data: parsed.data as T,
    savedAt: parsed.savedAt
  };
}

export function writePublicCache<T>(key: string, data: T, ttlMs: number): void {
  const storage = getPublicStorage();

  if (!storage) {
    return;
  }

  const savedAt = Date.now();
  const entry: CacheEntry<T> = {
    data,
    savedAt,
    expiresAt: savedAt + Math.max(0, ttlMs)
  };

  try {
    storage.setItem(key, JSON.stringify(entry));
  } catch {
    // Public cache is a performance hint. Quota or privacy-mode failures should not affect UI.
  }
}

export function removePublicCache(key: string): void {
  const storage = getPublicStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage errors; the app can always fetch public data again.
  }
}

export function getPublicSnapshotCache() {
  return readPublicCache<CmsSnapshot>(PUBLIC_SNAPSHOT_CACHE_KEY);
}

export function setPublicSnapshotCache(snapshot: CmsSnapshot) {
  writePublicCache(PUBLIC_SNAPSHOT_CACHE_KEY, snapshot, PUBLIC_SNAPSHOT_CACHE_TTL_MS);
}

export function getPublicContentDetailCache(slug: string | undefined) {
  if (!slug) {
    return null;
  }

  return readPublicCache<ContentItem>(getPublicContentDetailCacheKey(slug));
}

export function setPublicContentDetailCache(slug: string | undefined, content: ContentItem) {
  if (!slug) {
    return;
  }

  cleanupPublicContentDetailCache(maxContentDetailCacheEntries - 1);
  writePublicCache(getPublicContentDetailCacheKey(slug), content, PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS);
  cleanupPublicContentDetailCache(maxContentDetailCacheEntries);
}

export function clearPublicCmsCache() {
  removePublicCache(PUBLIC_SNAPSHOT_CACHE_KEY);
  getKeysByPrefix(PUBLIC_CONTENT_DETAIL_CACHE_PREFIX).forEach((key) => {
    removePublicCache(key);
  });
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as Window & { clearPublicCmsCache?: () => void }).clearPublicCmsCache = clearPublicCmsCache;
}
