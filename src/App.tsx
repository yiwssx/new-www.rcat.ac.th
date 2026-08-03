import type { QueryClient } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import AppProviders from "./AppProviders";
import type { AppRouter } from "./routes";

export interface AppProps {
  queryClient: QueryClient;
  router: AppRouter;
}

export default function App({ queryClient, router }: AppProps) {
  return (
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
