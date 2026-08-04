import {
  defaultShouldDehydrateQuery,
  dehydrate,
  hydrate,
  type DehydratedState,
  type QueryClient
} from "@tanstack/react-query";

export type PublicHydrationJsonValue =
  | null
  | boolean
  | number
  | string
  | PublicHydrationJsonValue[]
  | { [key: string]: PublicHydrationJsonValue };

export interface AppRouterDehydratedData {
  queryClientState: {
    mutations: PublicHydrationJsonValue[];
    queries: PublicHydrationJsonValue[];
  };
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

function toJsonSafeValue(value: unknown): PublicHydrationJsonValue {
  const serialized = JSON.stringify(value);

  if (serialized === undefined) {
    throw new TypeError("Public SSR query hydration state must be JSON-serializable.");
  }

  return JSON.parse(serialized) as PublicHydrationJsonValue;
}

export function dehydrateAppQueryClient(queryClient: QueryClient): AppRouterDehydratedData {
  const dehydrated = dehydrate(queryClient, {
    shouldDehydrateMutation: () => false,
    shouldDehydrateQuery: (query) => {
      const rootKey = query.queryKey[0];
      return (
        typeof rootKey === "string" && PUBLIC_SSR_QUERY_KEY_ROOTS.has(rootKey) && defaultShouldDehydrateQuery(query)
      );
    }
  });
  const jsonSafeState = toJsonSafeValue(dehydrated);

  if (!isRecord(jsonSafeState) || !Array.isArray(jsonSafeState.mutations) || !Array.isArray(jsonSafeState.queries)) {
    throw new TypeError("Public SSR query hydration state is invalid.");
  }

  return {
    queryClientState: {
      mutations: jsonSafeState.mutations,
      queries: jsonSafeState.queries
    }
  };
}

export function hydrateAppQueryClient(queryClient: QueryClient, dehydrated: unknown) {
  if (!isRecord(dehydrated) || !isRecord(dehydrated.queryClientState)) {
    return false;
  }

  const queryClientState = dehydrated.queryClientState;
  if (!Array.isArray(queryClientState.mutations) || !Array.isArray(queryClientState.queries)) {
    return false;
  }

  hydrate(queryClient, queryClientState as unknown as DehydratedState);
  return true;
}
