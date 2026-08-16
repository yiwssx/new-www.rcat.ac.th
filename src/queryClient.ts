import { QueryClient } from "@tanstack/react-query";
import { projectSettings } from "./config/projectSettings";
import { clearPublicCmsCache } from "./services/publicCmsCache";

let legacyPublicCacheRetired = false;

function retireLegacyPublicPersistence() {
  if (legacyPublicCacheRetired || typeof window === "undefined") {
    return;
  }

  clearPublicCmsCache();
  legacyPublicCacheRetired = true;
}

export function createAppQueryClient() {
  retireLegacyPublicPersistence();

  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: projectSettings.query.staleTimeMs,
        gcTime: projectSettings.query.gcTimeMs,
        retry: projectSettings.query.retry,
        refetchOnMount: projectSettings.query.refetchOnMount,
        refetchOnReconnect: projectSettings.query.refetchOnReconnect,
        refetchOnWindowFocus: projectSettings.query.refetchOnWindowFocus
      }
    }
  });
}

export type AppQueryClient = ReturnType<typeof createAppQueryClient>;
