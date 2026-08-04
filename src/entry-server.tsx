import React from "react";
import { RouterServer, createRequestHandler, renderRouterToString } from "@tanstack/react-router/ssr/server";
import AppProviders from "./AppProviders";
import { injectEmotionCriticalCssIntoResponse } from "./emotionSsr";
import { createAppRuntime } from "./runtime";

export async function renderSsrResponse(request: Request) {
  const runtime = createAppRuntime();
  const handler = createRequestHandler({
    request,
    createRouter: () => runtime.router
  });

  return handler(async ({ responseHeaders, router }) => {
    const response = await renderRouterToString({
      responseHeaders,
      router,
      children: (
        <AppProviders emotionCache={runtime.emotionCache} queryClient={runtime.queryClient}>
          <RouterServer router={router} />
        </AppProviders>
      )
    });

    return injectEmotionCriticalCssIntoResponse(response, runtime.emotionCache);
  });
}
