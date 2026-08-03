import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicEventListCache,
  PUBLIC_EVENT_LIST_CACHE_TTL_MS,
  publicEventListQueryOptions
} from "../../features/public-events";
import { isPublicQueryCacheFresh } from "../../features/public-read/queryPolicy";

export function usePublicEventList() {
  const cachedSnapshot = useMemo(() => getPublicEventListCache(), []);
  const hasFreshCache = cachedSnapshot
    ? isPublicQueryCacheFresh(cachedSnapshot.savedAt, PUBLIC_EVENT_LIST_CACHE_TTL_MS)
    : false;

  return useQuery({
    ...publicEventListQueryOptions({ consumeAbortSignal: false }),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true
  });
}
