// @vitest-environment node
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { CMS_AUTH_ROUTE_TABLE, handleCmsAuthDispatch, handleRetiredLegacyAuthentication } from "./dispatcher.mjs";
import {
  handleCmsAuthLogin,
  handleCmsAuthLogout,
  handleCmsAuthLogoutAll,
  handleCmsAuthSession,
  handleCmsInvitationAccept,
  handleCmsInvitationInspect,
  handleCmsMfaDisable,
  handleCmsMfaRecoveryRegenerate,
  handleCmsMfaSetupConfirm,
  handleCmsMfaSetupStart,
  handleCmsMfaVerify,
  handleCmsPasswordChange,
  handleCmsPasswordResetComplete,
  handleCmsPasswordResetInspect,
  handleCmsReauthenticate
} from "./handlers.mjs";

const routes = [
  { id: "login", publicPath: "/api/cms-auth/login", handler: handleCmsAuthLogin },
  { id: "session", publicPath: "/api/cms-auth/session", handler: handleCmsAuthSession },
  { id: "logout", publicPath: "/api/cms-auth/logout", handler: handleCmsAuthLogout },
  { id: "logout-all", publicPath: "/api/cms-auth/logout-all", handler: handleCmsAuthLogoutAll },
  { id: "change-password", publicPath: "/api/cms-auth/change-password", handler: handleCmsPasswordChange },
  {
    id: "invitation-inspect",
    publicPath: "/api/cms-auth/invitation/inspect",
    handler: handleCmsInvitationInspect
  },
  { id: "invitation-accept", publicPath: "/api/cms-auth/invitation/accept", handler: handleCmsInvitationAccept },
  {
    id: "password-reset-inspect",
    publicPath: "/api/cms-auth/password-reset/inspect",
    handler: handleCmsPasswordResetInspect
  },
  {
    id: "password-reset-complete",
    publicPath: "/api/cms-auth/password-reset/complete",
    handler: handleCmsPasswordResetComplete
  },
  { id: "mfa-verify", publicPath: "/api/cms-auth/mfa/verify", handler: handleCmsMfaVerify },
  { id: "mfa-setup-start", publicPath: "/api/cms-auth/mfa/setup/start", handler: handleCmsMfaSetupStart },
  { id: "mfa-setup-confirm", publicPath: "/api/cms-auth/mfa/setup/confirm", handler: handleCmsMfaSetupConfirm },
  {
    id: "mfa-recovery-regenerate",
    publicPath: "/api/cms-auth/mfa/recovery-codes/regenerate",
    handler: handleCmsMfaRecoveryRegenerate
  },
  { id: "mfa-disable", publicPath: "/api/cms-auth/mfa", handler: handleCmsMfaDisable },
  { id: "reauthenticate", publicPath: "/api/cms-auth/reauthenticate", handler: handleCmsReauthenticate },
  {
    id: "retired-admin-proxy-login",
    publicPath: "/api/admin-proxy-session/login",
    handler: handleRetiredLegacyAuthentication
  },
  {
    id: "retired-admin-proxy-logout",
    publicPath: "/api/admin-proxy-session/logout",
    handler: handleRetiredLegacyAuthentication
  }
];

function createRequest({ url, method = "PATCH", headers = {}, body = { marker: "body" }, query }) {
  const read = vi.fn(function readBody() {
    this.push("request-body");
    this.push(null);
  });
  const stream = new Readable({ read });
  stream.url = url;
  stream.method = method;
  stream.headers = headers;
  stream.body = body;
  if (query !== undefined) {
    stream.query = query;
  }
  return { request: stream, read };
}

function createResponse() {
  const headers = new Map();
  let body = "";

  return {
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    end(value) {
      body = value === undefined ? "" : String(value);
    },
    get bodyText() {
      return body;
    }
  };
}

function createHandlerMap() {
  return Object.fromEntries(routes.map(({ id }) => [id, vi.fn()]));
}

function callCount(handlers) {
  return Object.values(handlers).reduce((total, handler) => total + handler.mock.calls.length, 0);
}

describe("CMS-auth dispatcher", () => {
  it("uses the finite immutable production route table", () => {
    expect(CMS_AUTH_ROUTE_TABLE).toEqual(routes);
    expect(Object.isFrozen(CMS_AUTH_ROUTE_TABLE)).toBe(true);
    expect(CMS_AUTH_ROUTE_TABLE.every((route) => Object.isFrozen(route))).toBe(true);
  });

  it.each(routes)("dispatches $id to exactly its selected handler", async ({ id, publicPath }) => {
    const dispatchUrl = `/api/cms-auth?_rcatCmsRoute=${id}`;
    const headers = { host: "cms.example.invalid", "x-test-header": "preserved" };
    const body = { marker: "preserved" };
    const { request, read } = createRequest({ url: dispatchUrl, headers, body });
    const response = createResponse();
    const handlers = createHandlerMap();

    handlers[id].mockImplementation(async (selectedRequest) => {
      expect(selectedRequest.url).toBe(publicPath);
      expect(selectedRequest.method).toBe("PATCH");
      expect(selectedRequest.headers).toBe(headers);
      expect(selectedRequest.body).toBe(body);
    });

    await handleCmsAuthDispatch(request, response, { handlers });

    expect(handlers[id]).toHaveBeenCalledTimes(1);
    expect(callCount(handlers)).toBe(1);
    expect(request.url).toBe(dispatchUrl);
    expect(read).not.toHaveBeenCalled();
  });

  it.each(routes)(
    "dispatches $id when Vercel exposes rewrite parameters on request.query",
    async ({ id, publicPath }) => {
      const headers = { host: "cms.example.invalid", "x-vercel-test": "preserved" };
      const body = { marker: "preserved" };
      const { request, read } = createRequest({
        url: publicPath,
        headers,
        body,
        query: { _rcatCmsRoute: id }
      });
      const response = createResponse();
      const handlers = createHandlerMap();

      handlers[id].mockImplementation(async (selectedRequest) => {
        expect(selectedRequest.url).toBe(publicPath);
        expect(selectedRequest.headers).toBe(headers);
        expect(selectedRequest.body).toBe(body);
      });

      await handleCmsAuthDispatch(request, response, { handlers });

      expect(handlers[id]).toHaveBeenCalledTimes(1);
      expect(callCount(handlers)).toBe(1);
      expect(request.url).toBe(publicPath);
      expect(read).not.toHaveBeenCalled();
    }
  );

  it("accepts the internal function path when Vercel exposes only the rewrite query object", async () => {
    const { request, read } = createRequest({
      url: "/api/cms-auth",
      method: "GET",
      query: { _rcatCmsRoute: "session" }
    });
    const handlers = createHandlerMap();

    await handleCmsAuthDispatch(request, createResponse(), { handlers });

    expect(handlers.session).toHaveBeenCalledTimes(1);
    expect(callCount(handlers)).toBe(1);
    expect(request.url).toBe("/api/cms-auth");
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    ["missing route", "/api/cms-auth"],
    ["unknown route", "/api/cms-auth?_rcatCmsRoute=unknown"],
    ["empty route", "/api/cms-auth?_rcatCmsRoute="],
    ["duplicate route", "/api/cms-auth?_rcatCmsRoute=login&_rcatCmsRoute=session"],
    ["additional query", "/api/cms-auth?_rcatCmsRoute=login&token=secret"],
    ["URL-encoded route", "/api/cms-auth?_rcatCmsRoute=log%69n"],
    ["uppercase route", "/api/cms-auth?_rcatCmsRoute=LOGIN"],
    ["malformed URL", "http://[?_rcatCmsRoute=login"]
  ])("rejects a %s with a no-store 404", async (_name, url) => {
    const { request, read } = createRequest({ url });
    const response = createResponse();
    const handlers = createHandlerMap();

    await handleCmsAuthDispatch(request, response, { handlers });

    expect(response.statusCode).toBe(404);
    expect(response.getHeader("Cache-Control")).toBe("no-store");
    expect(response.getHeader("Content-Type")).toBe("application/json; charset=utf-8");
    expect(response.bodyText).toBe('{"error":"not found"}');
    expect(callCount(handlers)).toBe(0);
    expect(request.url).toBe(url);
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown query route", { _rcatCmsRoute: "unknown" }],
    ["array query route", { _rcatCmsRoute: ["login", "session"] }],
    ["additional query value", { _rcatCmsRoute: "login", token: "secret" }],
    ["wrong query key", { route: "login" }]
  ])("rejects an invalid Vercel %s with a no-store 404", async (_name, query) => {
    const { request, read } = createRequest({ url: "/api/cms-auth/login", query });
    const response = createResponse();
    const handlers = createHandlerMap();

    await handleCmsAuthDispatch(request, response, { handlers });

    expect(response.statusCode).toBe(404);
    expect(response.getHeader("Cache-Control")).toBe("no-store");
    expect(response.bodyText).toBe('{"error":"not found"}');
    expect(callCount(handlers)).toBe(0);
    expect(read).not.toHaveBeenCalled();
  });

  it("does not let a Vercel query route select a different public CMS-auth path", async () => {
    const { request, read } = createRequest({
      url: "/api/cms-auth/session",
      query: { _rcatCmsRoute: "login" }
    });
    const response = createResponse();
    const handlers = createHandlerMap();

    await handleCmsAuthDispatch(request, response, { handlers });

    expect(response.statusCode).toBe(404);
    expect(callCount(handlers)).toBe(0);
    expect(read).not.toHaveBeenCalled();
  });

  it("does not obtain the route from the path, headers, body, cookies, or Referer", async () => {
    const headers = {
      _rcatcmsroute: "login",
      cookie: "_rcatCmsRoute=login",
      referer: "https://cms.example.invalid/?_rcatCmsRoute=login"
    };
    const { request } = createRequest({
      url: "/api/cms-auth/login",
      headers,
      body: { _rcatCmsRoute: "login" }
    });
    const response = createResponse();
    const handlers = createHandlerMap();

    await handleCmsAuthDispatch(request, response, { handlers });

    expect(response.statusCode).toBe(404);
    expect(callCount(handlers)).toBe(0);
  });

  it("restores the original request URL when the selected handler throws", async () => {
    const dispatchUrl = "/api/cms-auth?_rcatCmsRoute=login";
    const { request, read } = createRequest({ url: dispatchUrl });
    const handlers = createHandlerMap();
    const error = new Error("handler failed");
    handlers.login.mockRejectedValue(error);

    await expect(handleCmsAuthDispatch(request, createResponse(), { handlers })).rejects.toBe(error);

    expect(request.url).toBe(dispatchUrl);
    expect(read).not.toHaveBeenCalled();
  });

  it("uses a narrow stream-preserving adapter when request.url is read-only", async () => {
    const dispatchUrl = "/api/cms-auth?_rcatCmsRoute=session";
    const headers = { host: "cms.example.invalid" };
    const body = { marker: "preserved" };
    const { request, read } = createRequest({ url: dispatchUrl, method: "GET", headers, body });
    const handlers = createHandlerMap();
    Object.defineProperty(request, "url", { configurable: true, value: dispatchUrl, writable: false });
    handlers.session.mockImplementation(async (selectedRequest) => {
      expect(selectedRequest.url).toBe("/api/cms-auth/session");
      expect(selectedRequest.method).toBe("GET");
      expect(selectedRequest.headers).toBe(headers);
      expect(selectedRequest.body).toBe(body);
    });

    await handleCmsAuthDispatch(request, createResponse(), { handlers });

    expect(handlers.session).toHaveBeenCalledTimes(1);
    expect(request.url).toBe(dispatchUrl);
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    ["retired-admin-proxy-login", "/api/admin-proxy-session/login"],
    ["retired-admin-proxy-logout", "/api/admin-proxy-session/logout"]
  ])("returns a finite 410 tombstone for $1 without consuming the request", async (id, publicPath) => {
    const { request, read } = createRequest({
      url: `/api/cms-auth?_rcatCmsRoute=${id}`,
      method: "POST",
      headers: {
        authorization: "Bearer ignored",
        cookie: "obsolete-cookie=ignored"
      },
      body: { email: "ignored@example.invalid", password: "ignored" }
    });
    const response = createResponse();

    await handleCmsAuthDispatch(request, response);

    expect(response.statusCode).toBe(410);
    expect(response.getHeader("Cache-Control")).toBe("no-store");
    expect(response.getHeader("Content-Type")).toBe("application/json; charset=utf-8");
    expect(response.bodyText).toBe('{"error":"legacy authentication is retired"}');
    expect(request.url).toBe(`/api/cms-auth?_rcatCmsRoute=${id}`);
    expect(read).not.toHaveBeenCalled();
    expect(publicPath).toContain("/api/admin-proxy-session/");
  });

  it.each(["GET", "PUT", "DELETE"])("rejects %s on a retired authentication path with 405", async (method) => {
    const { request, read } = createRequest({
      url: "/api/cms-auth?_rcatCmsRoute=retired-admin-proxy-login",
      method
    });
    const response = createResponse();

    await handleCmsAuthDispatch(request, response);

    expect(response.statusCode).toBe(405);
    expect(response.getHeader("Allow")).toBe("POST");
    expect(response.bodyText).toBe('{"error":"method not allowed"}');
    expect(read).not.toHaveBeenCalled();
  });
});
