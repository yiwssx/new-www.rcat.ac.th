import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { getOrganizationCollection, getOrganizationDetail, type OrganizationCollection } from "./api";

export const organizationAdminQueryKeys = {
  all: ["admin-organization"] as const,
  collection: (collection: OrganizationCollection) => ["admin-organization", collection] as const,
  list: (collection: OrganizationCollection, limit: number) =>
    ["admin-organization", collection, "list", limit] as const,
  detail: (collection: OrganizationCollection, id: string) => ["admin-organization", collection, "detail", id] as const
};

export function organizationCollectionQueryOptions<K extends OrganizationCollection>(collection: K, limit = 100) {
  return queryOptions({
    queryKey: organizationAdminQueryKeys.list(collection, limit),
    queryFn: () => getOrganizationCollection(collection, limit)
  });
}

export function organizationDetailQueryOptions<K extends OrganizationCollection>(collection: K, id: string) {
  return queryOptions({
    queryKey: organizationAdminQueryKeys.detail(collection, id),
    queryFn: () => getOrganizationDetail(collection, id)
  });
}

export function invalidateOrganizationQueries(queryClient: QueryClient, collection?: OrganizationCollection) {
  return queryClient.invalidateQueries({
    queryKey: collection ? organizationAdminQueryKeys.collection(collection) : organizationAdminQueryKeys.all
  });
}
