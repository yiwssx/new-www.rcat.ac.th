// @vitest-environment node

import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createAdminProxySessionCookie } from "../adminProxy/session.mjs";
import { handleAppsScriptProxyRequest } from "./handler.mjs";

const SESSION_SECRET = "fake-admin-proxy-session-secret-32-characters";
const BRIDGE_TOKEN = "fake-apps-script-bridge-token";

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
    get bodyJson() {
      return JSON.parse(body);
    }
  };
}

function createEnv() {
  return {
    ADMIN_PROXY_ALLOWED_EMAILS: "admin@example.test",
    ADMIN_PROXY_SESSION_SECRET: SESSION_SECRET,
    APPS_SCRIPT_BRIDGE_TOKEN: BRIDGE_TOKEN,
    GOOGLE_APPS_SCRIPT_URL: "https://script.google.com/macros/s/test-deployment/exec"
  };
}

async function createSessionHeader(env = createEnv()) {
  const cookie = await createAdminProxySessionCookie({
    email: "admin@example.test",
    secret: env.ADMIN_PROXY_SESSION_SECRET
  });

  return cookie.split(";", 1)[0];
}

async function createAuthenticatedRequest({ body, env = createEnv(), headers = {}, method = "POST" } = {}) {
  return createRequest({
    body,
    headers: {
      cookie: await createSessionHeader(env),
      ...headers
    },
    method
  });
}

describe("Vercel Apps Script media proxy", () => {
  it("reports redacted server bridge readiness to an authenticated admin", async () => {
    const fetchImpl = vi.fn();
    const response = createResponse();

    await handleAppsScriptProxyRequest(await createAuthenticatedRequest({ method: "GET" }), response, {
      env: createEnv(),
      fetchImpl
    });

    expect(response.statusCode).toBe(200);
    expect(response.bodyJson).toEqual({
      mode: "server-proxy",
      configured: true,
      appsScriptUrlConfigured: true,
      bridgeTokenConfigured: true
    });
    expect(JSON.stringify(response.bodyJson)).not.toContain("script.google.com");
    expect(JSON.stringify(response.bodyJson)).not.toContain(BRIDGE_TOKEN);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("accepts APPS_SCRIPT_WEB_APP_URL as the server-side Apps Script URL", async () => {
    const fetchImpl = vi.fn();
    const response = createResponse();
    const baseEnv = createEnv();
    const env = {
      ...baseEnv,
      GOOGLE_APPS_SCRIPT_URL: "",
      APPS_SCRIPT_WEB_APP_URL: baseEnv.GOOGLE_APPS_SCRIPT_URL
    };

    await handleAppsScriptProxyRequest(await createAuthenticatedRequest({ method: "GET", env }), response, {
      env,
      fetchImpl
    });

    expect(response.statusCode).toBe(200);
    expect(response.bodyJson).toMatchObject({
      configured: true,
      appsScriptUrlConfigured: true,
      bridgeTokenConfigured: true
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not treat VITE_GOOGLE_APPS_SCRIPT_URL as server proxy configuration", async () => {
    const fetchImpl = vi.fn();
    const response = createResponse();
    const baseEnv = createEnv();
    const env = {
      ...baseEnv,
      GOOGLE_APPS_SCRIPT_URL: "",
      APPS_SCRIPT_WEB_APP_URL: "",
      VITE_GOOGLE_APPS_SCRIPT_URL: baseEnv.GOOGLE_APPS_SCRIPT_URL
    };

    await handleAppsScriptProxyRequest(await createAuthenticatedRequest({ method: "GET", env }), response, {
      env,
      fetchImpl
    });

    expect(response.statusCode).toBe(200);
    expect(response.bodyJson).toMatchObject({
      configured: false,
      appsScriptUrlConfigured: false,
      bridgeTokenConfigured: true
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports missing server bridge configuration without exposing values", async () => {
    const response = createResponse();
    const env = { ...createEnv(), APPS_SCRIPT_BRIDGE_TOKEN: "" };

    await handleAppsScriptProxyRequest(await createAuthenticatedRequest({ method: "GET", env }), response, {
      env,
      fetchImpl: vi.fn()
    });

    expect(response.statusCode).toBe(200);
    expect(response.bodyJson).toMatchObject({ configured: false, bridgeTokenConfigured: false });
  });

  it("rejects structured resources outside the explicit media allowlist", async () => {
    for (const resource of ["content", "users", "snapshot", "public-home"]) {
      const fetchImpl = vi.fn();
      const response = createResponse();

      await handleAppsScriptProxyRequest(
        await createAuthenticatedRequest({ body: { resource, payload: { action: "list" } } }),
        response,
        { env: createEnv(), fetchImpl }
      );

      expect(response.statusCode).toBe(400);
      expect(response.getHeader("cache-control")).toBe("no-store");
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("rejects a request without a signed admin proxy session", async () => {
    const fetchImpl = vi.fn();
    const response = createResponse();

    await handleAppsScriptProxyRequest(
      createRequest({ body: { resource: "media", payload: { name: "original.png" } } }),
      response,
      { env: createEnv(), fetchImpl }
    );

    expect(response.statusCode).toBe(401);
    expect(response.bodyJson).toEqual({ error: "admin proxy session is required" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects media forwarding when the server bridge token is missing", async () => {
    const fetchImpl = vi.fn();
    const response = createResponse();
    const env = {
      ...createEnv(),
      APPS_SCRIPT_BRIDGE_TOKEN: ""
    };

    await handleAppsScriptProxyRequest(
      await createAuthenticatedRequest({ body: { resource: "media", payload: { name: "original.png" } }, env }),
      response,
      { env, fetchImpl }
    );

    expect(response.statusCode).toBe(503);
    expect(response.bodyJson).toEqual({ error: "Apps Script bridge token is not configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("forwards the media payload as text with only the server bridge token", async () => {
    const payload = {
      authToken: "admin-proxy.local.browser-marker",
      appsScriptBridgeToken: "browser-supplied-token",
      mediaBridgeToken: "browser-supplied-media-token",
      name: "original.png",
      size: "10 MB",
      fileBase64: "AAECAwQFBgcICQ=="
    };
    const upstreamResult = { id: "drive-media-1", name: payload.name, size: payload.size };
    const fetchImpl = vi.fn(async () => Response.json(upstreamResult));
    const response = createResponse();

    await handleAppsScriptProxyRequest(
      await createAuthenticatedRequest({ body: { resource: "media", payload } }),
      response,
      {
        env: createEnv(),
        fetchImpl
      }
    );

    expect(response.statusCode).toBe(200);
    expect(response.bodyJson).toEqual(upstreamResult);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBeInstanceOf(URL);
    expect(url.toString()).toContain("resource=media");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
    expect(JSON.parse(init.body)).toEqual({
      name: payload.name,
      size: payload.size,
      fileBase64: payload.fileBase64,
      appsScriptBridgeToken: BRIDGE_TOKEN
    });
    expect(init.body).not.toContain("admin-proxy.local.browser-marker");
    expect(init.body).not.toContain("browser-supplied-token");
    expect(init.body).not.toContain("browser-supplied-media-token");
  });

  it("maps deleteMedia to the Apps Script media-delete resource", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id: "drive-media-1", deleted: true }));
    const response = createResponse();

    await handleAppsScriptProxyRequest(
      await createAuthenticatedRequest({ body: { resource: "deleteMedia", payload: { id: "drive-media-1" } } }),
      response,
      { env: createEnv(), fetchImpl }
    );

    expect(fetchImpl.mock.calls[0][0].toString()).toContain("resource=media-delete");
  });

  it("returns 502 when Apps Script returns a non-success response", async () => {
    const response = createResponse();
    const fileBase64 = "AAECAwQFBgcICQ==";

    await handleAppsScriptProxyRequest(
      await createAuthenticatedRequest({ body: { resource: "media", payload: { fileBase64, name: "original.png" } } }),
      response,
      {
        env: createEnv(),
        fetchImpl: vi.fn(
          async () =>
            new Response(`failed fileBase64=${fileBase64} appsScriptBridgeToken=${BRIDGE_TOKEN} ${"x".repeat(500)}`, {
              status: 404
            })
        )
      }
    );

    expect(response.statusCode).toBe(502);
    expect(response.bodyJson).toMatchObject({
      error: "Apps Script bridge failed",
      diagnostic: "apps-script-bridge-upstream-v2",
      upstreamResource: "media",
      upstreamStatus: 404
    });
    expect(response.bodyJson.upstreamBodySnippet).toHaveLength(300);
    expect(response.bodyJson.upstreamBodySnippet).not.toContain(fileBase64);
    expect(response.bodyJson.upstreamBodySnippet).not.toContain(BRIDGE_TOKEN);
  });

  it("returns 503 without exposing details when the server Apps Script URL is missing", async () => {
    const response = createResponse();

    await handleAppsScriptProxyRequest(
      await createAuthenticatedRequest({ body: { resource: "media", payload: { name: "original.png" } } }),
      response,
      { env: { ...createEnv(), GOOGLE_APPS_SCRIPT_URL: "" }, fetchImpl: vi.fn() }
    );

    expect(response.statusCode).toBe(503);
    expect(response.bodyJson).toEqual({ error: "Apps Script URL is not configured" });
  });
});
