import type { PublicReadRequestOptions } from "./request";

export const PUBLIC_QUERY_GC_TIME_MS = 60 * 60 * 1000;

export interface PublicQueryRuntimeOptions {
  consumeAbortSignal?: boolean;
}

export function getPublicQueryRequestOptions(
  context: { readonly signal: AbortSignal },
  options: PublicQueryRuntimeOptions = {}
): PublicReadRequestOptions {
  if (options.consumeAbortSignal === false) {
    return {};
  }

  return { signal: context.signal };
}

export function isPublicQueryCacheFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}
