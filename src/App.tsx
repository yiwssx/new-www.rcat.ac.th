import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { Provider as ReduxProvider } from "react-redux";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { projectSettings } from "./config/projectSettings";
import { router } from "./routes";
import { store } from "./store/store";
import { theme } from "./theme";

const queryClient = new QueryClient({
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

export default function App() {
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LanguageProvider>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <RouterProvider router={router} />
            </ThemeProvider>
          </LanguageProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
}
