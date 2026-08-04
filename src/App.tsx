import type { EmotionCache } from "@emotion/cache";
import type { QueryClient } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import AppProviders from "./AppProviders";
import type { AppRouter } from "./routes";

export interface AppProps {
  emotionCache: EmotionCache;
  queryClient: QueryClient;
  router: AppRouter;
}

export default function App({ emotionCache, queryClient, router }: AppProps) {
  return (
    <AppProviders emotionCache={emotionCache} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
