import { useQuery } from "@tanstack/react-query";
import { publicShellQueryOptions } from "../../features/public-shell";

interface UsePublicShellSnapshotOptions {
  enabled?: boolean;
}

export function usePublicShellSnapshot(options: UsePublicShellSnapshotOptions = {}) {
  const enabled = options.enabled ?? true;

  return useQuery({
    ...publicShellQueryOptions({ consumeAbortSignal: false }),
    enabled
  });
}
