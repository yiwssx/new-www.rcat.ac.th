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

function getPublicSnapshotCached(options) {
  return getPublicCachedJsonResponse({
    resource: "snapshot",
    cacheKey: PUBLIC_SNAPSHOT_CACHE_KEY,
    debugPerformance: Boolean(options && options.debugPerformance),
    buildPayload: () =>
      getSnapshot({
        includeUnpublished: false
      })
  });
}

function getPublicHomeSnapshotCached(options) {
  return getPublicCachedJsonResponse({
    resource: "public-home",
    cacheKey: PUBLIC_HOME_CACHE_KEY,
    debugPerformance: Boolean(options && options.debugPerformance),
    buildPayload: getPublicHomeSnapshot
  });
}

function getPublicContentListSnapshotCached(query, options) {
  const kind = getPublicContentListCacheKind(query);

  if (!kind) {
    return getPublicUncachedJsonResponse({
      resource: "public-content-list",
      cacheKey: "",
      debugPerformance: Boolean(options && options.debugPerformance),
      skipReason: "invalid-cache-kind",
      buildPayload: () => getPublicContentListSnapshot(query)
    });
  }

  const cacheKey = `${PUBLIC_CONTENT_LIST_CACHE_PREFIX}${kind}`;

  return getPublicCachedJsonResponse({
    resource: "public-content-list",
    cacheKey,
    debugPerformance: Boolean(options && options.debugPerformance),
    buildPayload: () => getPublicContentListSnapshot(query)
  });
}

function getPublicProgramListSnapshotCached(options) {
  return getPublicCachedJsonResponse({
    resource: "public-program-list",
    cacheKey: PUBLIC_PROGRAM_LIST_CACHE_KEY,
    debugPerformance: Boolean(options && options.debugPerformance),
    buildPayload: getPublicProgramListSnapshot
  });
}

function getPublicSearchIndexSnapshotCached(options) {
  return getPublicCachedJsonResponse({
    resource: "public-search-index",
    cacheKey: PUBLIC_SEARCH_INDEX_CACHE_KEY,
    debugPerformance: Boolean(options && options.debugPerformance),
    buildPayload: getPublicSearchIndexSnapshot
  });
}

function getPublicContentDetailCached(query, options) {
  const cacheKey = getPublicContentDetailCacheKey(query);

  if (!cacheKey) {
    return getPublicUncachedJsonResponse({
      resource: "content-detail",
      cacheKey: "",
      debugPerformance: Boolean(options && options.debugPerformance),
      skipReason: "cache-key-unavailable",
      buildPayload: () =>
        getContentDetail(query, {
          includeUnpublished: false
        })
    });
  }

  return getPublicCachedJsonResponse({
    resource: "content-detail",
    cacheKey,
    debugPerformance: Boolean(options && options.debugPerformance),
    buildPayload: () =>
      getContentDetail(query, {
        includeUnpublished: false
      })
  });
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

function getPublicCachedJsonResponse(config) {
  const startedAt = getPerformanceNowMs();
  const diagnostics = createPublicCacheDiagnostics(config.resource, config.cacheKey);
  const cachedPayload = getCachedJson(config.cacheKey, diagnostics);

  if (cachedPayload) {
    diagnostics.cacheHit = true;
    diagnostics.cacheMiss = false;
    diagnostics.totalDurationMs = getPerformanceDurationMs(startedAt);
    return withPublicCacheDiagnostics(cachedPayload, diagnostics, config.debugPerformance);
  }

  return buildAndMaybeCachePublicJsonResponse(config, diagnostics, startedAt);
}

function getPublicUncachedJsonResponse(config) {
  const startedAt = getPerformanceNowMs();
  const diagnostics = createPublicCacheDiagnostics(config.resource, config.cacheKey || "");

  diagnostics.cacheRead.returnedPayload = false;
  diagnostics.cacheWrite = {
    attempted: false,
    success: false,
    skipped: true,
    reason: config.skipReason || "cache-disabled",
    payloadBytes: 0,
    maxValueBytes: PUBLIC_CACHE_MAX_VALUE_BYTES
  };

  const buildStartedAt = getPerformanceNowMs();
  const payload = config.buildPayload();
  diagnostics.buildPayloadDurationMs = getPerformanceDurationMs(buildStartedAt);
  diagnostics.payloadBytes = estimateJsonPayloadBytes(payload);
  diagnostics.totalDurationMs = getPerformanceDurationMs(startedAt);

  return withPublicCacheDiagnostics(payload, diagnostics, config.debugPerformance);
}

function buildAndMaybeCachePublicJsonResponse(config, diagnostics, startedAt) {
  const buildStartedAt = getPerformanceNowMs();
  const payload = config.buildPayload();

  diagnostics.buildPayloadDurationMs = getPerformanceDurationMs(buildStartedAt);
  diagnostics.cacheWrite = putCachedJson(config.cacheKey, payload, PUBLIC_SNAPSHOT_CACHE_SECONDS);
  diagnostics.payloadBytes = diagnostics.cacheWrite.payloadBytes || estimateJsonPayloadBytes(payload);
  diagnostics.totalDurationMs = getPerformanceDurationMs(startedAt);

  return withPublicCacheDiagnostics(payload, diagnostics, config.debugPerformance);
}

function createPublicCacheDiagnostics(resource, cacheKey) {
  return {
    resource,
    cacheKey,
    cacheHit: false,
    cacheMiss: true,
    totalDurationMs: 0,
    buildPayloadDurationMs: 0,
    payloadBytes: 0,
    cacheMaxValueBytes: PUBLIC_CACHE_MAX_VALUE_BYTES,
    cacheRead: {
      returnedPayload: false,
      payloadBytes: 0,
      parseError: false,
      removeCachedValueCalled: false
    },
    cacheWrite: {
      attempted: false,
      success: false,
      skipped: false,
      reason: "",
      payloadBytes: 0,
      maxValueBytes: PUBLIC_CACHE_MAX_VALUE_BYTES
    }
  };
}

function withPublicCacheDiagnostics(payload, diagnostics, debugPerformance) {
  if (!debugPerformance) {
    return payload;
  }

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return {
      ...payload,
      debugPerformance: diagnostics
    };
  }

  return {
    data: payload,
    debugPerformance: diagnostics
  };
}

function getCachedJson(key, diagnostics) {
  try {
    const value = getPublicCache().get(key);

    if (!value) {
      if (diagnostics) {
        diagnostics.cacheRead.returnedPayload = false;
      }
      return null;
    }

    if (diagnostics) {
      diagnostics.cacheRead.returnedPayload = true;
      diagnostics.cacheRead.payloadBytes = estimateUtf8Bytes(value);
    }

    return JSON.parse(value);
  } catch (error) {
    console.warn(`Unable to read cache key ${key}: ${error.message || error}`);
    if (diagnostics) {
      diagnostics.cacheRead.parseError = true;
      diagnostics.cacheRead.removeCachedValueCalled = true;
    }
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
    return createCacheWriteResult({
      attempted: false,
      success: false,
      skipped: true,
      reason: "serialize-failed"
    });
  }

  const payloadBytes = estimateUtf8Bytes(value);

  if (payloadBytes > PUBLIC_CACHE_MAX_VALUE_BYTES) {
    console.warn(
      `Skipping cache write for ${key}: payload is ${payloadBytes} bytes, limit is ${PUBLIC_CACHE_MAX_VALUE_BYTES} bytes.`
    );
    return createCacheWriteResult({
      attempted: true,
      success: false,
      skipped: true,
      reason: "payload-too-large",
      payloadBytes
    });
  }

  try {
    getPublicCache().put(key, value, seconds);
    return createCacheWriteResult({
      attempted: true,
      success: true,
      skipped: false,
      reason: "",
      payloadBytes
    });
  } catch (error) {
    console.warn(`Unable to write cache key ${key}: ${error.message || error}`);
    return createCacheWriteResult({
      attempted: true,
      success: false,
      skipped: false,
      reason: "cache-put-failed",
      payloadBytes
    });
  }
}

function createCacheWriteResult(input) {
  const config = input || {};

  return {
    attempted: Boolean(config.attempted),
    success: Boolean(config.success),
    skipped: Boolean(config.skipped),
    reason: config.reason || "",
    payloadBytes: Number(config.payloadBytes || 0),
    maxValueBytes: PUBLIC_CACHE_MAX_VALUE_BYTES
  };
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

function estimateJsonPayloadBytes(payload) {
  try {
    return estimateUtf8Bytes(JSON.stringify(payload));
  } catch (error) {
    return 0;
  }
}

function getPerformanceNowMs() {
  return new Date().getTime();
}

function getPerformanceDurationMs(startedAt) {
  return Math.max(0, getPerformanceNowMs() - startedAt);
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
