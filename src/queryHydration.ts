import {
  defaultShouldDehydrateQuery,
  dehydrate,
  hydrate,
  type DehydratedState,
  type QueryClient
} from "@tanstack/react-query";

export interface AppRouterDehydratedData {
  queryClientState: DehydratedState;
}

const PUBLIC_SSR_QUERY_KEY_ROOTS = new Set([
  "public-shell",
  "public-home-snapshot",
  "public-content-list",
  "public-program-list",
  "public-document-list",
  "public-event-list",
  "public-search-index",
  "content-detail",
  "cms-snapshot"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function dehydrateAppQueryClient(
  queryClient: QueryClient
): AppRouterDehydratedData {
  return {
    queryClientState: dehydrate(queryClient, {
      shouldDehydrateQuery: (query) => {
        const rootKey = query.queryKey[0];
        return (
          typeof rootKey === "string" &&
          PUBLIC_SSR_QUERY_KEY_ROOTS.has(rootKey) &&
          defaultShouldDehydrateQuery(query)
        );
      }
    })
  };
}

export function hydrateAppQueryClient(
  queryClient: QueryClient,
  dehydrated: unknown
) {
  if (!isRecord(dehydrated) || !("queryClientState" in dehydrated)) {
    return false;
  }

  hydrate(queryClient, dehydrated.queryClientState as DehydratedState);
  return true;
}
