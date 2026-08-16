import { useQuery } from "@tanstack/react-query";
import { publicSearchIndexQueryOptions } from "../../features/public-search";

export function usePublicSearchIndex(query = "", page?: number, pageSize?: number, enabled = true) {
  const normalizedQuery = query.trim();
  const paginated = page !== undefined && pageSize !== undefined;

  return useQuery({
    ...publicSearchIndexQueryOptions(
      normalizedQuery,
      { consumeAbortSignal: false },
      paginated
        ? {
            page,
            pageSize
          }
        : undefined
    ),
    enabled
  });
}
