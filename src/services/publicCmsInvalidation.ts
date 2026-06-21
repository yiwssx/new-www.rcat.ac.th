import type { QueryClient } from "@tanstack/react-query";
import { clearPublicCmsCache } from "./publicCmsCache";

const PUBLIC_QUERY_ROOTS = new Set([
  "cms-snapshot",
  "content-detail",
  "public-content-list",
  "public-document-list",
  "public-home-snapshot",
  "public-program-list",
  "public-search-index"
]);

export async function invalidatePublicCmsData(queryClient: QueryClient) {
  clearPublicCmsCache();
  await queryClient.invalidateQueries({
    predicate: (query) => PUBLIC_QUERY_ROOTS.has(String(query.queryKey[0] ?? ""))
  });
}
