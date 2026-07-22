import {
  handleCmsAuthLogin,
  handleCmsAuthLogout,
  handleCmsAuthLogoutAll,
  handleCmsAuthSession,
  handleCmsInvitationAccept,
  handleCmsInvitationInspect,
  handleCmsPasswordChange,
  handleCmsPasswordResetComplete,
  handleCmsPasswordResetInspect
} from "./handlers.mjs";

const ROUTE_PARAMETER = "_rcatCmsRoute";

export const CMS_AUTH_ROUTE_TABLE = Object.freeze([
  Object.freeze({ id: "login", publicPath: "/api/cms-auth/login", handler: handleCmsAuthLogin }),
  Object.freeze({ id: "session", publicPath: "/api/cms-auth/session", handler: handleCmsAuthSession }),
  Object.freeze({ id: "logout", publicPath: "/api/cms-auth/logout", handler: handleCmsAuthLogout }),
  Object.freeze({ id: "logout-all", publicPath: "/api/cms-auth/logout-all", handler: handleCmsAuthLogoutAll }),
  Object.freeze({
    id: "change-password",
    publicPath: "/api/cms-auth/change-password",
    handler: handleCmsPasswordChange
  }),
  Object.freeze({
    id: "invitation-inspect",
    publicPath: "/api/cms-auth/invitation/inspect",
    handler: handleCmsInvitationInspect
  }),
  Object.freeze({
    id: "invitation-accept",
    publicPath: "/api/cms-auth/invitation/accept",
    handler: handleCmsInvitationAccept
  }),
  Object.freeze({
    id: "password-reset-inspect",
    publicPath: "/api/cms-auth/password-reset/inspect",
    handler: handleCmsPasswordResetInspect
  }),
  Object.freeze({
    id: "password-reset-complete",
    publicPath: "/api/cms-auth/password-reset/complete",
    handler: handleCmsPasswordResetComplete
  })
]);

function findRoute(requestUrl) {
  if (
    typeof requestUrl !== "string" ||
    requestUrl.length === 0 ||
    requestUrl.includes("#") ||
    /%(?![0-9a-f]{2})/iu.test(requestUrl)
  ) {
    return null;
  }

  try {
    const parsedUrl = new URL(requestUrl, "https://cms-auth-dispatch.invalid");
    const parameters = [...parsedUrl.searchParams.entries()];

    if (
      !parsedUrl.pathname.startsWith("/") ||
      !["http:", "https:"].includes(parsedUrl.protocol) ||
      parameters.length !== 1
    ) {
      return null;
    }

    const [[name, value]] = parameters;

    if (name !== ROUTE_PARAMETER || value.length === 0) {
      return null;
    }

    const route = CMS_AUTH_ROUTE_TABLE.find((candidate) => candidate.id === value);

    if (!route || parsedUrl.search !== `?${ROUTE_PARAMETER}=${route.id}`) {
      return null;
    }

    return route;
  } catch {
    return null;
  }
}

function sendNotFound(response) {
  response.statusCode = 404;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify({ error: "not found" }));
}

function getSelectedHandler(route, injectedHandlers) {
  if (injectedHandlers === undefined) {
    return route.handler;
  }

  if (
    injectedHandlers === null ||
    typeof injectedHandlers !== "object" ||
    !Object.prototype.hasOwnProperty.call(injectedHandlers, route.id)
  ) {
    return null;
  }

  const handler = Reflect.get(injectedHandlers, route.id);
  return typeof handler === "function" ? handler : null;
}

function createReadOnlyUrlAdapter(request, canonicalUrl) {
  return new Proxy(request, {
    get(target, property) {
      if (property === "url") {
        return canonicalUrl;
      }

      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, property, value) {
      if (property === "url") {
        return false;
      }

      return Reflect.set(target, property, value, target);
    }
  });
}

function canonicalizeRequestUrl(request, canonicalUrl) {
  const originalUrl = request.url;

  try {
    request.url = canonicalUrl;

    if (request.url === canonicalUrl) {
      return {
        request,
        restore() {
          request.url = originalUrl;
        }
      };
    }
  } catch {
    // Some runtimes expose request.url as read-only. The adapter below keeps the original stream intact.
  }

  try {
    if (request.url !== originalUrl) {
      request.url = originalUrl;
    }
  } catch {
    // A read-only URL remains unchanged on the original request.
  }

  return {
    request: createReadOnlyUrlAdapter(request, canonicalUrl),
    restore() {}
  };
}

export async function handleCmsAuthDispatch(request, response, options = {}) {
  const route = findRoute(request?.url);

  if (!route) {
    sendNotFound(response);
    return;
  }

  const handler = getSelectedHandler(route, options.handlers);

  if (!handler) {
    sendNotFound(response);
    return;
  }

  const canonicalRequest = canonicalizeRequestUrl(request, route.publicPath);

  try {
    await handler(canonicalRequest.request, response);
  } finally {
    canonicalRequest.restore();
  }
}
