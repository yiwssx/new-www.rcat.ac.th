export const PUBLIC_QUERY_GC_TIME_MS = 60 * 60 * 1000;

export function isPublicQueryCacheFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}
