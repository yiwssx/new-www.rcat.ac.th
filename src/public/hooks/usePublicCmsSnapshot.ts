import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicCmsSnapshotForProvider,
  publicCmsSnapshotQueryOptions
} from "../../features/public-read/cmsSnapshot";
import { isPublicQueryCacheFresh } from "../../features/public-read/queryPolicy";
import {
  getPublicSnapshotCache,
  PUBLIC_SNAPSHOT_CACHE_TTL_MS
} from "../../services/publicCmsCache";

interface UsePublicCmsSnapshotOptions {
  enabled?: boolean;
}

export { getPublicCmsSnapshotForProvider };

export function usePublicCmsSnapshot(options: UsePublicCmsSnapshotOptions = {}) {
  const enabled = options.enabled ?? true;
  const cachedSnapshot = useMemo(() => getPublicSnapshotCache(), []);
  const hasFreshCache = cachedSnapshot
    ? isPublicQueryCacheFresh(cachedSnapshot.savedAt, PUBLIC_SNAPSHOT_CACHE_TTL_MS)
    : false;

  return useQuery({
    ...publicCmsSnapshotQueryOptions(),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    enabled,
    refetchOnMount: enabled && (cachedSnapshot ? !hasFreshCache : true)
  });
}
