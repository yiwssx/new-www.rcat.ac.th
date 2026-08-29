import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { RouterClient } from "@tanstack/react-router/ssr/client";
import App from "./App";
import AppProviders from "./AppProviders";
import { projectSettings } from "./config/projectSettings";
import { createAppRuntime } from "./runtime";
import { SSR_DOCUMENT_MARKER_ATTRIBUTE, SSR_DOCUMENT_MARKER_VALUE } from "./ssrAssets";
import { installBrowserErrorFilters } from "./utils/browserErrorFilters";

export function shouldHydrateClientApp(rootElement: HTMLElement) {
  return rootElement.hasChildNodes();
}

export function shouldHydrateSsrDocument(documentElement: HTMLElement = document.documentElement) {
  return documentElement.getAttribute(SSR_DOCUMENT_MARKER_ATTRIBUTE) === SSR_DOCUMENT_MARKER_VALUE;
}

export function readDocumentCspNonce(documentNode: Document = document) {
  const script = documentNode.querySelector<HTMLScriptElement>("script[nonce]");
  return script?.nonce || script?.getAttribute("nonce") || undefined;
}

export function mountClientApp(rootElement: HTMLElement) {
  installBrowserErrorFilters();
  document.documentElement.lang = projectSettings.site.language;

  const documentMode = shouldHydrateSsrDocument();
  const runtime = createAppRuntime({
    documentMode,
    cspNonce: documentMode ? readDocumentCspNonce() : undefined
  });
  const routerClient = (
    <React.StrictMode>
      <AppProviders emotionCache={runtime.emotionCache} queryClient={runtime.queryClient}>
        <RouterClient router={runtime.router} />
      </AppProviders>
    </React.StrictMode>
  );

  if (documentMode) {
    hydrateRoot(document, routerClient);
    return runtime;
  }

  if (shouldHydrateClientApp(rootElement)) {
    hydrateRoot(rootElement, routerClient);
    return runtime;
  }

  createRoot(rootElement).render(
    <React.StrictMode>
      <App emotionCache={runtime.emotionCache} queryClient={runtime.queryClient} router={runtime.router} />
    </React.StrictMode>
  );

  return runtime;
}
