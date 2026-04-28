const PUBLIC_SNAPSHOT_CACHE_KEY = "cms:public:snapshot:v1";
const PUBLIC_MENU_CACHE_KEY = "cms:public:menu:v1";
const PUBLIC_DISPLAY_SETTINGS_CACHE_KEY = "cms:public:display-settings:v1";
const PUBLIC_SNAPSHOT_CACHE_SECONDS = 300;

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
  try {
    getPublicCache().put(key, JSON.stringify(payload), seconds);
  } catch (error) {
    console.warn(`Unable to write cache key ${key}: ${error.message || error}`);
  }
}

function removeCachedValue(key) {
  try {
    getPublicCache().remove(key);
  } catch (error) {
    console.warn(`Unable to remove cache key ${key}: ${error.message || error}`);
  }
}
