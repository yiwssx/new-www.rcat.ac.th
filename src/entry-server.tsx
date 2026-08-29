import { randomBytes } from "node:crypto";
import React from "react";
import { RouterServer, createRequestHandler, renderRouterToString } from "@tanstack/react-router/ssr/server";
import AppProviders from "./AppProviders";
import { createEmotionSsrResponseFinalizer } from "./emotionSsr";
import { applyPublicSsrHttpSemantics } from "./public/routing/publicHttpSemantics";
import { createAppRuntime } from "./runtime";
import { buildContentSecurityPolicy } from "./security/cspPolicy";

export async function renderSsrResponse(request: Request) {
  const cspNonce = randomBytes(24).toString("base64url");
  const runtime = createAppRuntime({ documentMode: true, cspNonce });
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
    const securityHeaders = new Headers(emotionResponse.headers);
    securityHeaders.set("Content-Security-Policy-Report-Only", buildContentSecurityPolicy({ scriptNonce: cspNonce }));
    const securedResponse = new Response(emotionResponse.body, {
      status: emotionResponse.status,
      statusText: emotionResponse.statusText,
      headers: securityHeaders
    });

    return applyPublicSsrHttpSemantics({
      request,
      response: securedResponse,
      matches: router.state.matches
    });
  });
}
