import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicHomeCache,
  PUBLIC_HOME_CACHE_TTL_MS,
  publicHomeQueryOptions
} from "../../features/public-home";
import { isPublicQueryCacheFresh } from "../../features/public-read/queryPolicy";

export function usePublicHomeSnapshot() {
  const cachedSnapshot = useMemo(() => getPublicHomeCache(), []);
  const hasFreshCache = cachedSnapshot
    ? isPublicQueryCacheFresh(cachedSnapshot.savedAt, PUBLIC_HOME_CACHE_TTL_MS)
    : false;

  return useQuery({
    ...publicHomeQueryOptions(),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true
  });
}
