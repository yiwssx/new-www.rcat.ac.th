const PUBLIC_SNAPSHOT_CACHE_KEY = "cms:public:snapshot:v1";
const PUBLIC_HOME_CACHE_KEY = "cms:public:home:v1";
const PUBLIC_PROGRAM_LIST_CACHE_KEY = "cms:public:program-list:v1";
const PUBLIC_SEARCH_INDEX_CACHE_KEY = "cms:public:search-index:v1";
const PUBLIC_CONTENT_LIST_CACHE_PREFIX = "cms:public:content-list:v1:";
const PUBLIC_CONTENT_DETAIL_CACHE_PREFIX = "cms:public:content-detail:v1:";
const PUBLIC_CACHE_VERSION_PROPERTY_KEY = "cms:public:cache-version:v1";
const PUBLIC_MENU_CACHE_KEY = "cms:public:menu:v1";
const PUBLIC_DISPLAY_SETTINGS_CACHE_KEY = "cms:public:display-settings:v1";
const PUBLIC_SNAPSHOT_CACHE_SECONDS = 300;
const PUBLIC_CACHE_MAX_VALUE_BYTES = 95 * 1024;

function getPublicSnapshotCached() {
  const cachedSnapshot = getCachedJson(PUBLIC_SNAPSHOT_CACHE_KEY);

  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  const snapshot = getSnapshot({
    includeUnpublished: false
  });

  putCachedJson(PUBLIC_SNAPSHOT_CACHE_KEY, snapshot, PUBLIC_SNAPSHOT_CACHE_SECONDS);
  return snapshot;
}

function getPublicHomeSnapshotCached() {
  const cachedSnapshot = getCachedJson(PUBLIC_HOME_CACHE_KEY);

  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  const snapshot = getPublicHomeSnapshot();

  putCachedJson(PUBLIC_HOME_CACHE_KEY, snapshot, PUBLIC_SNAPSHOT_CACHE_SECONDS);
  return snapshot;
}

function getPublicContentListSnapshotCached(query) {
  const kind = getPublicContentListCacheKind(query);

  if (!kind) {
    return getPublicContentListSnapshot(query);
  }

  const cacheKey = `${PUBLIC_CONTENT_LIST_CACHE_PREFIX}${kind}`;
  const cachedSnapshot = getCachedJson(cacheKey);

  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  const snapshot = getPublicContentListSnapshot(query);

  putCachedJson(cacheKey, snapshot, PUBLIC_SNAPSHOT_CACHE_SECONDS);
  return snapshot;
}

function getPublicProgramListSnapshotCached() {
  const cachedSnapshot = getCachedJson(PUBLIC_PROGRAM_LIST_CACHE_KEY);

  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  const snapshot = getPublicProgramListSnapshot();

  putCachedJson(PUBLIC_PROGRAM_LIST_CACHE_KEY, snapshot, PUBLIC_SNAPSHOT_CACHE_SECONDS);
  return snapshot;
}

function getPublicSearchIndexSnapshotCached() {
  const cachedSnapshot = getCachedJson(PUBLIC_SEARCH_INDEX_CACHE_KEY);

  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  const snapshot = getPublicSearchIndexSnapshot();

  putCachedJson(PUBLIC_SEARCH_INDEX_CACHE_KEY, snapshot, PUBLIC_SNAPSHOT_CACHE_SECONDS);
  return snapshot;
}

function getPublicContentDetailCached(query) {
  const cacheKey = getPublicContentDetailCacheKey(query);

  if (!cacheKey) {
    return getContentDetail(query, {
      includeUnpublished: false
    });
  }

  const cachedDetail = getCachedJson(cacheKey);

  if (cachedDetail) {
    return cachedDetail;
  }

  const detail = getContentDetail(query, {
    includeUnpublished: false
  });

  putCachedJson(cacheKey, detail, PUBLIC_SNAPSHOT_CACHE_SECONDS);
  return detail;
}

function invalidatePublicSnapshotCache() {
  removeCachedValue(PUBLIC_SNAPSHOT_CACHE_KEY);
  removeCachedValue(PUBLIC_HOME_CACHE_KEY);
  removeCachedValue(PUBLIC_PROGRAM_LIST_CACHE_KEY);
  removeCachedValue(PUBLIC_SEARCH_INDEX_CACHE_KEY);
  ["news", "announcements", "blog"].forEach((kind) => {
    removeCachedValue(`${PUBLIC_CONTENT_LIST_CACHE_PREFIX}${kind}`);
  });
  refreshPublicCacheVersion();
}

function getPublicCache() {
  return CacheService.getScriptCache();
}

function getCachedJson(key) {
  try {
    const value = getPublicCache().get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value);
  } catch (error) {
    console.warn(`Unable to read cache key ${key}: ${error.message || error}`);
    removeCachedValue(key);
    return null;
  }
}

function putCachedJson(key, payload, seconds) {
  let value;

  try {
    value = JSON.stringify(payload);
  } catch (error) {
    console.warn(`Unable to serialize cache key ${key}: ${error.message || error}`);
    return false;
  }

  const payloadBytes = estimateUtf8Bytes(value);

  if (payloadBytes > PUBLIC_CACHE_MAX_VALUE_BYTES) {
    console.warn(
      `Skipping cache write for ${key}: payload is ${payloadBytes} bytes, limit is ${PUBLIC_CACHE_MAX_VALUE_BYTES} bytes.`
    );
    return false;
  }

  try {
    getPublicCache().put(key, value, seconds);
    return true;
  } catch (error) {
    console.warn(`Unable to write cache key ${key}: ${error.message || error}`);
    return false;
  }
}

function removeCachedValue(key) {
  try {
    getPublicCache().remove(key);
  } catch (error) {
    console.warn(`Unable to remove cache key ${key}: ${error.message || error}`);
  }
}

function estimateUtf8Bytes(value) {
  let bytes = 0;

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);

    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint >= 0xd800 && codePoint <= 0xdbff && index + 1 < value.length) {
      const nextCodePoint = value.charCodeAt(index + 1);

      if (nextCodePoint >= 0xdc00 && nextCodePoint <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }

  return bytes;
}

function getPublicContentListCacheKind(query) {
  const config = query || {};
  const normalized = String(config.kind || config.type || "")
    .trim()
    .toLowerCase();

  return ["news", "announcements", "blog"].indexOf(normalized) === -1 ? "" : normalized;
}

function getPublicContentDetailCacheKey(query) {
  const config = query || {};
  const id = String(config.id || "").trim();
  const slug = String(config.slug || "").trim();
  const lookupType = id ? "id" : "slug";
  const lookupValue = id || slug;

  if (!lookupValue) {
    return "";
  }

  const encodedLookupValue = encodeURIComponent(lookupValue);

  if (encodedLookupValue.length > 160) {
    return "";
  }

  return `${PUBLIC_CONTENT_DETAIL_CACHE_PREFIX}${getPublicCacheVersion()}:${lookupType}:${encodedLookupValue}`;
}

function getPublicCacheVersion() {
  try {
    return PropertiesService.getScriptProperties().getProperty(PUBLIC_CACHE_VERSION_PROPERTY_KEY) || "1";
  } catch (error) {
    console.warn(`Unable to read public cache version: ${error.message || error}`);
    return "1";
  }
}

function refreshPublicCacheVersion() {
  try {
    PropertiesService.getScriptProperties().setProperty(
      PUBLIC_CACHE_VERSION_PROPERTY_KEY,
      String(new Date().getTime())
    );
  } catch (error) {
    console.warn(`Unable to refresh public cache version: ${error.message || error}`);
  }
}
