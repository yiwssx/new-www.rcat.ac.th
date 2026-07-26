// @vitest-environment node

import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { getCmsCsrfCookieName, getCmsSessionCookieName } from "../cmsAuth/cookies.mjs";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_BROWSER_CSRF_HEADER,
  CMS_CLIENT_IP_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  CMS_USER_AGENT_HEADER
} from "../cmsAuth/handlers.mjs";
import { handleAppsScriptProxyRequest, MAX_REQUEST_BODY_BYTES } from "./handler.mjs";

const BRIDGE_TOKEN = "fake-apps-script-bridge-token";
const CMS_SESSION_TOKEN = "A".repeat(43);
const CMS_CSRF_TOKEN = "B".repeat(43);
const CMS_PROXY_SECRET = "C".repeat(40);
const CMS_WORKER_ORIGIN = "https://worker.example.test";
const OBSOLETE_COOKIE = "__Host-rcat_admin_proxy_session=obsolete-value";

function createRequest({ body, headers = {}, method = "POST" } = {}) {
  const request = Readable.from(body === undefined ? [] : [typeof body === "string" ? body : JSON.stringify(body)]);
  request.method = method;
  request.headers = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
  return request;
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
    },
    get bodyJson() {
      return JSON.parse(body);
    }
  };
}

function createEnv(overrides = {}) {
  return {
    APPS_SCRIPT_BRIDGE_TOKEN: BRIDGE_TOKEN,
    CLOUDFLARE_ADMIN_API_URL: CMS_WORKER_ORIGIN,
    CMS_AUTH_PROXY_SECRET: CMS_PROXY_SECRET,
    GOOGLE_APPS_SCRIPT_URL: "https://script.google.com/macros/s/test-deployment/exec",
    ...overrides
  };
}

function cmsCookie({ csrfToken = "", extras = [], sessionToken = CMS_SESSION_TOKEN } = {}) {
  return [
    `${getCmsSessionCookieName()}=${sessionToken}`,
    ...(csrfToken ? [`${getCmsCsrfCookieName()}=${csrfToken}`] : []),
    ...extras
  ].join("; ");
}

function cmsRequest({
  body,
  csrfCookie = "",
  csrfHeader = "",
  extras = [],
  headers = {},
  method = "GET",
  sessionToken = CMS_SESSION_TOKEN
} = {}) {
  return createRequest({
    body,
    method,
    headers: {
      cookie: cmsCookie({ csrfToken: csrfCookie, extras, sessionToken }),
      ...(csrfHeader ? { [CMS_BROWSER_CSRF_HEADER]: csrfHeader } : {}),
      ...headers
    }
  });
}

function capabilityResponse(capabilities) {
  return Response.json({ role: "admin", capabilities });
}

function authorizationSuccess() {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" }
  });
}

async function callProxy({ env = createEnv(), fetchImpl, request } = {}) {
  const response = createResponse();
  await handleAppsScriptProxyRequest(request ?? cmsRequest(), response, {
    env,
    fetchImpl: fetchImpl ?? vi.fn(async () => capabilityResponse(["media.read"]))
  });
  return response;
}

describe("CMS-only Vercel Apps Script media proxy", () => {
  it.each(["GET", "HEAD"])("authorizes %s status with media.read and no CSRF", async (method) => {
    const fetchImpl = vi.fn(async () => capabilityResponse(["media.read"]));
    const response = await callProxy({
      fetchImpl,
      request: cmsRequest({
        method,
        headers: { "user-agent": "test-agent", "x-forwarded-for": "203.0.113.20" }
      })
    });

    expect(response.statusCode).toBe(200);
    expect(response.getHeader("Cache-Control")).toBe("no-store");
    expect(method === "HEAD" ? response.bodyText : response.bodyJson).toEqual(
      method === "HEAD"
        ? ""
        : {
            mode: "server-proxy",
            appsScriptBridge: "connected",
            driveStorage: "connected"
          }
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${CMS_WORKER_ORIGIN}/api/admin/capabilities`);
    expect(init.method).toBe("GET");
    expect(init.headers.get(CMS_AUTH_PROXY_SECRET_HEADER)).toBe(CMS_PROXY_SECRET);
    expect(init.headers.get(CMS_SESSION_TOKEN_HEADER)).toBe(CMS_SESSION_TOKEN);
    expect(init.headers.get(CMS_CLIENT_IP_HEADER)).toBe("203.0.113.20");
    expect(init.headers.get(CMS_USER_AGENT_HEADER)).toBe("test-agent");
  });

  it("returns a finite redacted status when bridge configuration is absent", async () => {
    const response = await callProxy({
      env: createEnv({ APPS_SCRIPT_BRIDGE_TOKEN: "", GOOGLE_APPS_SCRIPT_URL: "" })
    });

    expect(response.bodyJson).toEqual({
      mode: "server-proxy",
      appsScriptBridge: "not-configured",
      driveStorage: "not-configured"
    });
    expect(response.bodyText).not.toContain("script.google.com");
    expect(response.bodyText).not.toContain(BRIDGE_TOKEN);
  });

  it("uses the supported alternate server-side Apps Script URL variable", async () => {
    const url = "https://script.google.com/macros/s/alternate-test-deployment/exec";
    const response = await callProxy({
      env: createEnv({ APPS_SCRIPT_WEB_APP_URL: url, GOOGLE_APPS_SCRIPT_URL: "" })
    });

    expect(response.statusCode).toBe(200);
    expect(response.bodyJson.appsScriptBridge).toBe("connected");
    expect(response.bodyText).not.toContain(url);
  });

  it("requires a CMS Session before Worker or Apps Script calls", async () => {
    const fetchImpl = vi.fn();
    const response = await callProxy({
      fetchImpl,
      request: createRequest({ method: "GET" })
    });

    expect(response.statusCode).toBe(401);
    expect(response.bodyJson).toEqual({ error: "CMS session is invalid or expired" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([OBSOLETE_COOKIE, "__Host-rcat_admin_proxy_session=%broken"])(
    "does not authenticate an inert old cookie alone",
    async (cookie) => {
      const fetchImpl = vi.fn();
      const response = await callProxy({
        fetchImpl,
        request: createRequest({ method: "GET", headers: { cookie } })
      });

      expect(response.statusCode).toBe(401);
      expect(response.bodyJson).toEqual({ error: "CMS session is invalid or expired" });
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  );

  it("ignores an obsolete cookie when a valid CMS Session is present", async () => {
    const fetchImpl = vi.fn(async () => capabilityResponse(["media.read"]));
    const response = await callProxy({
      fetchImpl,
      request: cmsRequest({ extras: [OBSOLETE_COOKIE], method: "GET" })
    });

    expect(response.statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(response.getHeader("set-cookie")).toBeUndefined();
  });

  it("requires media.read for status", async () => {
    const response = await callProxy({
      fetchImpl: vi.fn(async () => capabilityResponse(["dashboard.read"]))
    });

    expect(response.statusCode).toBe(403);
    expect(response.bodyJson).toEqual({ error: "media bridge access is forbidden" });
  });

  it.each([
    ["missing", ""],
    ["malformed", "not-a-token"],
    ["different", "D".repeat(43)]
  ])("requires exact CMS CSRF for POST when the header is %s", async (_label, csrfHeader) => {
    const fetchImpl = vi.fn();
    const response = await callProxy({
      fetchImpl,
      request: cmsRequest({
        body: { resource: "media", payload: {} },
        csrfCookie: CMS_CSRF_TOKEN,
        csrfHeader,
        method: "POST"
      })
    });

    expect(response.statusCode).toBe(403);
    expect(response.bodyJson).toEqual({ error: "CSRF validation failed" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a malformed CSRF cookie before Worker or Apps Script calls", async () => {
    const fetchImpl = vi.fn();
    const response = await callProxy({
      fetchImpl,
      request: cmsRequest({
        body: { resource: "media", payload: {} },
        csrfCookie: "not-a-token",
        csrfHeader: CMS_CSRF_TOKEN,
        method: "POST"
      })
    });

    expect(response.statusCode).toBe(403);
    expect(response.bodyJson).toEqual({ error: "CSRF validation failed" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects duplicate CSRF cookies before Worker or Apps Script calls", async () => {
    const fetchImpl = vi.fn();
    const response = await callProxy({
      fetchImpl,
      request: cmsRequest({
        body: { resource: "media", payload: {} },
        csrfCookie: CMS_CSRF_TOKEN,
        csrfHeader: CMS_CSRF_TOKEN,
        extras: [`${getCmsCsrfCookieName()}=${CMS_CSRF_TOKEN}`],
        method: "POST"
      })
    });

    expect(response.statusCode).toBe(403);
    expect(response.bodyJson).toEqual({ error: "CSRF validation failed" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a matching fabricated CSRF pair when the Worker rejects its D1 Session hash", async () => {
    const fabricatedCsrfToken = "F".repeat(43);
    const fetchImpl = vi.fn(async () =>
      Response.json({ error: "CSRF validation failed", resource: "admin-structured-data" }, { status: 403 })
    );
    const response = await callProxy({
      fetchImpl,
      request: cmsRequest({
        body: { resource: "media", payload: {} },
        csrfCookie: fabricatedCsrfToken,
        csrfHeader: fabricatedCsrfToken,
        method: "POST"
      })
    });

    expect(response.statusCode).toBe(403);
    expect(response.bodyJson).toEqual({ error: "CSRF validation failed" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${CMS_WORKER_ORIGIN}/api/admin/media-bridge-authorization`);
  });

  it("requires media.manage from the exact Worker authorization probe", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { error: "required permission is missing", resource: "media-bridge-authorization" },
        { status: 403 }
      )
    );
    const response = await callProxy({
      fetchImpl,
      request: cmsRequest({
        body: { resource: "media", payload: {} },
        csrfCookie: CMS_CSRF_TOKEN,
        csrfHeader: CMS_CSRF_TOKEN,
        method: "POST"
      })
    });

    expect(response.statusCode).toBe(403);
    expect(response.bodyJson).toEqual({ error: "media bridge access is forbidden" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "invalid Session",
      Response.json({ error: "internal Session detail", sessionId: CMS_SESSION_TOKEN }, { status: 401 }),
      401,
      { error: "CMS session is invalid or expired" }
    ],
    [
      "unavailable authentication",
      Response.json({ error: "internal Worker detail", binding: "DB" }, { status: 503 }),
      503,
      { error: "CMS authentication is unavailable" }
    ]
  ])("maps Worker %s without forwarding its response body", async (_label, workerResponse, status, body) => {
    const fetchImpl = vi.fn(async () => workerResponse);
    const response = await callProxy({
      fetchImpl,
      request: cmsRequest({
        body: { resource: "media", payload: {} },
        csrfCookie: CMS_CSRF_TOKEN,
        csrfHeader: CMS_CSRF_TOKEN,
        method: "POST"
      })
    });

    expect(response.statusCode).toBe(status);
    expect(response.bodyJson).toEqual(body);
    expect(response.bodyText).not.toContain(CMS_SESSION_TOKEN);
    expect(response.bodyText).not.toContain("binding");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("preserves the finite Worker reauthentication contract without forwarding internal details", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        {
          error: "reauthentication required",
          resource: "admin-structured-data",
          assurance: "mfa",
          internal: CMS_SESSION_TOKEN
        },
        { status: 428 }
      )
    );
    const response = await callProxy({
      fetchImpl,
      request: cmsRequest({
        body: { resource: "media", payload: {} },
        csrfCookie: CMS_CSRF_TOKEN,
        csrfHeader: CMS_CSRF_TOKEN,
        method: "POST"
      })
    });

    expect(response.statusCode).toBe(428);
    expect(response.bodyJson).toEqual({ error: "reauthentication required", assurance: "mfa" });
    expect(response.bodyText).not.toContain(CMS_SESSION_TOKEN);
    expect(response.bodyText).not.toContain("internal");
  });

  it("authorizes a media mutation and replaces all browser-supplied bridge credentials", async () => {
    const browserSecret = "browser-supplied-secret";
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(authorizationSuccess())
      .mockResolvedValueOnce(Response.json({ ok: true, id: "media-1" }));
    const response = await callProxy({
      fetchImpl,
      request: cmsRequest({
        body: {
          resource: "media",
          payload: {
            fileName: "photo.jpg",
            authToken: browserSecret,
            appsScriptBridgeToken: browserSecret,
            mediaBridgeToken: browserSecret
          }
        },
        csrfCookie: CMS_CSRF_TOKEN,
        csrfHeader: CMS_CSRF_TOKEN,
        method: "POST"
      })
    });

    expect(response.statusCode).toBe(200);
    expect(response.bodyJson).toEqual({ ok: true, id: "media-1" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [authorizationUrl, authorizationInit] = fetchImpl.mock.calls[0];
    expect(authorizationUrl).toBe(`${CMS_WORKER_ORIGIN}/api/admin/media-bridge-authorization`);
    expect(authorizationInit.method).toBe("POST");
    expect(authorizationInit.headers.get(CMS_AUTH_PROXY_SECRET_HEADER)).toBe(CMS_PROXY_SECRET);
    expect(authorizationInit.headers.get(CMS_SESSION_TOKEN_HEADER)).toBe(CMS_SESSION_TOKEN);
    expect(authorizationInit.headers.get(CMS_CSRF_TOKEN_HEADER)).toBe(CMS_CSRF_TOKEN);
    const [appsUrl, appsInit] = fetchImpl.mock.calls[1];
    expect(appsUrl).toBeInstanceOf(URL);
    expect(appsUrl.hostname).toBe("script.google.com");
    expect(appsUrl.searchParams.get("resource")).toBe("media");
    expect(JSON.parse(appsInit.body)).toEqual({
      fileName: "photo.jpg",
      appsScriptBridgeToken: BRIDGE_TOKEN
    });
    expect(response.bodyText).not.toContain(BRIDGE_TOKEN);
    expect(response.bodyText).not.toContain(browserSecret);
  });

  it("rejects an invalid Apps Script URL after CMS authorization", async () => {
    const fetchImpl = vi.fn(async () => authorizationSuccess());
    const response = await callProxy({
      env: createEnv({ GOOGLE_APPS_SCRIPT_URL: "https://attacker.example.test/bridge" }),
      fetchImpl,
      request: cmsRequest({
        body: { resource: "media", payload: {} },
        csrfCookie: CMS_CSRF_TOKEN,
        csrfHeader: CMS_CSRF_TOKEN,
        method: "POST"
      })
    });

    expect(response.statusCode).toBe(503);
    expect(response.bodyJson).toEqual({ error: "Apps Script URL is not configured" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("sanitizes upstream media diagnostics", async () => {
    const fileBase64 = "sensitive-file-content";
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(authorizationSuccess())
      .mockResolvedValueOnce(
        new Response(`failure fileBase64=${fileBase64}&uploadKey=secret-upload-key&token=${BRIDGE_TOKEN}`, {
          status: 500
        })
      );
    const response = await callProxy({
      fetchImpl,
      request: cmsRequest({
        body: {
          resource: "startMediaUpload",
          payload: { fileBase64, uploadKey: "secret-upload-key" }
        },
        csrfCookie: CMS_CSRF_TOKEN,
        csrfHeader: CMS_CSRF_TOKEN,
        method: "POST"
      })
    });

    expect(response.statusCode).toBe(502);
    expect(response.bodyText).not.toContain(fileBase64);
    expect(response.bodyText).not.toContain("secret-upload-key");
    expect(response.bodyText).not.toContain(BRIDGE_TOKEN);
  });

  it("preserves the request body limit", async () => {
    const fetchImpl = vi.fn(async () => authorizationSuccess());
    const response = await callProxy({
      fetchImpl,
      request: cmsRequest({
        body: "x".repeat(MAX_REQUEST_BODY_BYTES + 1),
        csrfCookie: CMS_CSRF_TOKEN,
        csrfHeader: CMS_CSRF_TOKEN,
        method: "POST"
      })
    });

    expect(response.statusCode).toBe(413);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects cross-origin requests before authentication", async () => {
    const fetchImpl = vi.fn();
    const response = await callProxy({
      fetchImpl,
      request: cmsRequest({
        headers: { host: "cms.example.test", origin: "https://attacker.example.test" }
      })
    });

    expect(response.statusCode).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
