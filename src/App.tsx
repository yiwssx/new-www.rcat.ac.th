import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { AuthProvider } from "./context/AuthContext";
import { projectSettings } from "./config/projectSettings";
import { router } from "./routes";
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <RouterProvider router={router} />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
