import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CmsSnapshot, PublicContentDetailSnapshot } from "../../types";
import { getPublicCmsSnapshotForProvider, publicCmsSnapshotQueryOptions } from "../../features/public-read/cmsSnapshot";

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

/**
 * Legacy compatibility hook. Production components should prefer
 * usePublicShellSnapshot plus feature-specific queries.
 */
export function usePublicCmsSnapshot(options: UsePublicCmsSnapshotOptions = {}) {
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();
  const query = useQuery({
    ...publicCmsSnapshotQueryOptions({ consumeAbortSignal: false }),
    enabled
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
