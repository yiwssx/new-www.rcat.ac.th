import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicProgramListCache,
  PUBLIC_PROGRAM_LIST_CACHE_TTL_MS,
  publicProgramListQueryOptions
} from "../../features/public-programs";
import { isPublicQueryCacheFresh } from "../../features/public-read/queryPolicy";

export function usePublicProgramList() {
  const cachedSnapshot = useMemo(() => getPublicProgramListCache(), []);
  const hasFreshCache = cachedSnapshot
    ? isPublicQueryCacheFresh(cachedSnapshot.savedAt, PUBLIC_PROGRAM_LIST_CACHE_TTL_MS)
    : false;

  return useQuery({
    ...publicProgramListQueryOptions({ consumeAbortSignal: false }),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true
  });
}
