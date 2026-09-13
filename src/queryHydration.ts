import {
  defaultShouldDehydrateQuery,
  dehydrate,
  hydrate,
  type DehydratedState,
  type QueryClient
} from "@tanstack/react-query";

export type PublicHydrationJsonValue =
  null | boolean | number | string | PublicHydrationJsonValue[] | { [key: string]: PublicHydrationJsonValue };

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
  "content-detail"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertJsonSerializable(value: unknown) {
  if (JSON.stringify(value) === undefined) {
    throw new TypeError("Public SSR query hydration state must be JSON-serializable.");
  }
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

  // Production SSR already serializes this state when TanStack Router writes the
  // document payload. Avoid the former stringify+parse deep clone on every request;
  // keep the serializability assertion in development where it is actionable.
  if (import.meta.env.DEV) {
    assertJsonSerializable(dehydrated);
  }

  return {
    queryClientState: {
      mutations: dehydrated.mutations as unknown as PublicHydrationJsonValue[],
      queries: dehydrated.queries as unknown as PublicHydrationJsonValue[]
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
