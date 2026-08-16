export const PUBLIC_CACHE_FRESHNESS_MS = {
  shell: 2 * 60 * 1000,
  collection: 15 * 60 * 1000,
  detail: 30 * 60 * 1000
} as const;

export const PUBLIC_QUERY_GC_TIME_MS = 60 * 60 * 1000;

export type PublicCacheFreshnessClass = keyof typeof PUBLIC_CACHE_FRESHNESS_MS;

export function getPublicCacheFreshnessMs(cacheClass: PublicCacheFreshnessClass) {
  return PUBLIC_CACHE_FRESHNESS_MS[cacheClass];
}
