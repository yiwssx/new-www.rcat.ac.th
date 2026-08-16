import type { QueryClient } from "@tanstack/react-query";

const PUBLIC_QUERY_ROOTS = new Set([
  "content-detail",
  "public-content-list",
  "public-document-list",
  "public-event-list",
  "public-home-snapshot",
  "public-program-list",
  "public-search-index",
  "public-shell"
]);

export async function invalidatePublicCmsData(queryClient: QueryClient) {
  await queryClient.invalidateQueries({
    predicate: (query) => PUBLIC_QUERY_ROOTS.has(String(query.queryKey[0] ?? ""))
  });
}

export async function invalidateDeletedPublicContent(queryClient: QueryClient, slug: string | undefined) {
  if (slug) {
    queryClient.removeQueries({ queryKey: ["content-detail", slug], exact: true });
  }

  await invalidatePublicCmsData(queryClient);
}
