import type { PropsWithChildren } from "react";
import type { EmotionCache } from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { theme } from "./theme";

export interface AppProvidersProps extends PropsWithChildren {
  emotionCache: EmotionCache;
  queryClient: QueryClient;
}

export default function AppProviders({ emotionCache, queryClient, children }: AppProvidersProps) {
  return (
    <CacheProvider value={emotionCache}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </CacheProvider>
  );
}
