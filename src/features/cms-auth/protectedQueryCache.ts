import type { QueryClient } from "@tanstack/react-query";

export function isProtectedAdminQuery(queryKey: readonly unknown[]) {
  const prefix = queryKey[0];
  return typeof prefix === "string" && prefix.startsWith("admin-");
}

export function clearProtectedAdminQueries(queryClient: QueryClient) {
  queryClient.removeQueries({
    predicate: (query) => isProtectedAdminQuery(query.queryKey)
  });
}
