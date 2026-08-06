import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CmsSnapshot, PublicContentDetailSnapshot } from "../../types";
import { getPublicCmsSnapshotForProvider, publicCmsSnapshotQueryOptions } from "../../features/public-read/cmsSnapshot";
import { isPublicQueryCacheFresh } from "../../features/public-read/queryPolicy";
import { getPublicSnapshotCache, PUBLIC_SNAPSHOT_CACHE_TTL_MS } from "../../services/publicCmsCache";

interface UsePublicCmsSnapshotOptions {
  enabled?: boolean;
}

function mergeContentDetailMedia(
  snapshot: CmsSnapshot | undefined,
  detailSnapshots: PublicContentDetailSnapshot[]
): CmsSnapshot | undefined {
  if (!snapshot || detailSnapshots.length === 0) {
    return snapshot;
  }

  const mediaById = new Map(snapshot.media.map((asset) => [asset.id, asset]));

  detailSnapshots.forEach((detail) => {
    detail.media.forEach((asset) => {
      mediaById.set(asset.id, asset);
    });
  });

  return {
    ...snapshot,
    media: [...mediaById.values()]
  };
}

export { getPublicCmsSnapshotForProvider };

export function usePublicCmsSnapshot(options: UsePublicCmsSnapshotOptions = {}) {
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();
  const cachedSnapshot = useMemo(() => getPublicSnapshotCache(), []);
  const hasFreshCache = cachedSnapshot
    ? isPublicQueryCacheFresh(cachedSnapshot.savedAt, PUBLIC_SNAPSHOT_CACHE_TTL_MS)
    : false;
  const query = useQuery({
    ...publicCmsSnapshotQueryOptions({ consumeAbortSignal: false }),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    enabled,
    refetchOnMount: enabled && (cachedSnapshot ? !hasFreshCache : true)
  });
  const detailSnapshots = queryClient
    .getQueriesData<PublicContentDetailSnapshot | null>({ queryKey: ["content-detail"] })
    .map(([, detail]) => detail)
    .filter((detail): detail is PublicContentDetailSnapshot => detail !== null && detail !== undefined);

  return {
    ...query,
    data: mergeContentDetailMedia(query.data, detailSnapshots)
  };
}
