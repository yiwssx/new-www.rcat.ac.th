import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { RouterClient } from "@tanstack/react-router/ssr/client";
import App from "./App";
import AppProviders from "./AppProviders";
import { projectSettings } from "./config/projectSettings";
import { createAppRuntime } from "./runtime";
import { installBrowserErrorFilters } from "./utils/browserErrorFilters";

export function shouldHydrateClientApp(rootElement: HTMLElement) {
  return rootElement.hasChildNodes();
}

export function mountClientApp(rootElement: HTMLElement) {
  installBrowserErrorFilters();
  document.documentElement.lang = projectSettings.site.language;

  const runtime = createAppRuntime();

  if (shouldHydrateClientApp(rootElement)) {
    hydrateRoot(
      rootElement,
      <React.StrictMode>
        <AppProviders emotionCache={runtime.emotionCache} queryClient={runtime.queryClient}>
          <RouterClient router={runtime.router} />
        </AppProviders>
      </React.StrictMode>
    );

    return runtime;
  }

  createRoot(rootElement).render(
    <React.StrictMode>
      <App emotionCache={runtime.emotionCache} queryClient={runtime.queryClient} router={runtime.router} />
    </React.StrictMode>
  );

  return runtime;
}
