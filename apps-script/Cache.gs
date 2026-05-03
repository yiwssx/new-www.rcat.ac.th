const PUBLIC_SNAPSHOT_CACHE_KEY = "cms:public:snapshot:v1";
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

function invalidatePublicSnapshotCache() {
  removeCachedValue(PUBLIC_SNAPSHOT_CACHE_KEY);
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
