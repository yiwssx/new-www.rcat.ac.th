import React from "react";
import { RouterServer, createRequestHandler, renderRouterToString } from "@tanstack/react-router/ssr/server";
import AppProviders from "./AppProviders";
import { createAppRuntime } from "./runtime";

export async function renderSsrResponse(request: Request) {
  const runtime = createAppRuntime();
  const handler = createRequestHandler({
    request,
    createRouter: () => runtime.router
  });

  return handler(({ request: handlerRequest, responseHeaders, router }) =>
    renderRouterToString({
      request: handlerRequest,
      responseHeaders,
      router,
      children: (
        <AppProviders queryClient={runtime.queryClient}>
          <RouterServer router={router} />
        </AppProviders>
      )
    })
  );
}
