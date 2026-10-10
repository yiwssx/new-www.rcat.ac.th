import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_CACHE_FRESHNESS_MS,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import { getPublicOrganizationDetail } from "./api";

export const publicOrganizationDetailQueryKey = (slug: string) => ["public-organization-detail", slug] as const;

export function publicOrganizationDetailQueryOptions(slug: string, runtimeOptions: PublicQueryRuntimeOptions = {}) {
  return queryOptions({
    queryKey: publicOrganizationDetailQueryKey(slug),
    queryFn: (context) =>
      getPublicOrganizationDetail(slug, getPublicQueryRequestOptions(context, runtimeOptions)),
    enabled: Boolean(slug),
    staleTime: PUBLIC_CACHE_FRESHNESS_MS.detail,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
