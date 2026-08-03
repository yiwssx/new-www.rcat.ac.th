import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { projectSettings } from "./config/projectSettings";
import { createAppRuntime } from "./runtime";
import { installBrowserErrorFilters } from "./utils/browserErrorFilters";

export function mountClientApp(rootElement: HTMLElement) {
  installBrowserErrorFilters();
  document.documentElement.lang = projectSettings.site.language;

  const runtime = createAppRuntime();

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App queryClient={runtime.queryClient} router={runtime.router} />
    </React.StrictMode>
  );

  return runtime;
}
