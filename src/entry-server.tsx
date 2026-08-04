import React from "react";
import { RouterServer, createRequestHandler, renderRouterToString } from "@tanstack/react-router/ssr/server";
import AppProviders from "./AppProviders";
import { createEmotionSsrResponseFinalizer } from "./emotionSsr";
import { applyPublicSsrHttpSemantics } from "./public/routing/publicHttpSemantics";
import { createAppRuntime } from "./runtime";

export async function renderSsrResponse(request: Request) {
  const runtime = createAppRuntime();
  const finalizeEmotionSsrResponse = createEmotionSsrResponseFinalizer(runtime.emotionCache);
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
    const emotionResponse = await finalizeEmotionSsrResponse(response);

    return applyPublicSsrHttpSemantics({
      request,
      response: emotionResponse,
      matches: router.state.matches
    });
  });
}
