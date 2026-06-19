// @vitest-environment node

import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { handleAdminProxyRequest, handleAdminProxySessionLogin, handleAdminProxySessionLogout } from "./handlers.mjs";
import { createAdminProxySessionCookie, getAdminProxySessionCookieName } from "./session.mjs";

const SESSION_SECRET = "fake-admin-proxy-session-secret-32-characters";
const ALLOWED_EMAIL = "admin@example.test";

function createEnv(overrides = {}) {
  return {
    ADMIN_PROXY_ALLOWED_EMAILS: ALLOWED_EMAIL,
    ADMIN_PROXY_PASSWORD_HASH: "$2b$04$fake-test-hash-not-used-directly",
    ADMIN_PROXY_SESSION_SECRET: SESSION_SECRET,
    CLOUDFLARE_ADMIN_API_URL: "https://preview-worker.example.test",
    CLOUDFLARE_ADMIN_SMOKE_TOKEN: "fake-server-only-smoke-token",
    ...overrides
  };
}

function createRequest({ body, headers = {}, method = "GET", url = "/" } = {}) {
  const request = Readable.from(body === undefined ? [] : [typeof body === "string" ? body : JSON.stringify(body)]);
  request.method = method;
  request.url = url;
  request.headers = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
  return request;
}

function createResponse() {
  const headers = new Map();
  let body = Buffer.alloc(0);

  return {
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    end(value) {
      body = value === undefined ? Buffer.alloc(0) : Buffer.from(value);
    },
    get bodyText() {
      return body.toString("utf8");
    }
  };
}

function proxyUrl(path) {
  return path === undefined ? "/api/admin-proxy" : `/api/admin-proxy?path=${encodeURIComponent(path)}`;
}

async function createSessionHeader(env = createEnv()) {
  const cookie = await createAdminProxySessionCookie({
    email: ALLOWED_EMAIL,
    secret: env.ADMIN_PROXY_SESSION_SECRET,
    nowMs: Date.parse("2026-06-19T05:00:00.000Z")
  });

  return cookie.split(";", 1)[0];
}

describe("Vercel admin proxy", () => {
  it("rejects a request without a signed admin proxy session", async () => {
    const fetchImpl = vi.fn();
    const response = createResponse();

    await handleAdminProxyRequest(createRequest({ url: proxyUrl("/api/admin/snapshot") }), response, {
      env: createEnv(),
      fetchImpl,
      nowMs: Date.parse("2026-06-19T05:01:00.000Z")
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.bodyText)).toEqual({ error: "admin proxy session is required" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", undefined],
    ["absolute URL", "https://attacker.example.test/api/admin/snapshot"],
    ["path traversal", "/api/admin/../public/documents"],
    ["encoded path traversal", "/api/admin/%2e%2e/public/documents"],
    ["multiply encoded path traversal", "/api/admin/%25252e%25252e/public/documents"],
    ["non-admin path", "/api/public/documents"]
  ])("rejects an invalid %s target before calling the Worker", async (_label, path) => {
    const env = createEnv();
    const fetchImpl = vi.fn();
    const response = createResponse();

    await handleAdminProxyRequest(
      createRequest({
        url: proxyUrl(path),
        headers: { cookie: await createSessionHeader(env) }
      }),
      response,
      { env, fetchImpl, nowMs: Date.parse("2026-06-19T05:01:00.000Z") }
    );

    expect(response.statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["tampered", async (env) => `${await createSessionHeader(env)}tampered`, 401],
    [
      "expired",
      async (env) => {
        const cookie = await createAdminProxySessionCookie({
          email: ALLOWED_EMAIL,
          secret: env.ADMIN_PROXY_SESSION_SECRET,
          nowMs: Date.parse("2026-06-19T03:00:00.000Z")
        });
        return cookie.split(";", 1)[0];
      },
      401
    ],
    [
      "non-allowed identity",
      async (env) => {
        const cookie = await createAdminProxySessionCookie({
          email: "other@example.test",
          secret: env.ADMIN_PROXY_SESSION_SECRET,
          nowMs: Date.parse("2026-06-19T05:00:00.000Z")
        });
        return cookie.split(";", 1)[0];
      },
      403
    ]
  ])("rejects a %s signed-session request", async (_label, makeCookie, expectedStatus) => {
    const env = createEnv();
    const fetchImpl = vi.fn();
    const response = createResponse();

    await handleAdminProxyRequest(
      createRequest({
        url: proxyUrl("/api/admin/snapshot"),
        headers: { cookie: await makeCookie(env) }
      }),
      response,
      { env, fetchImpl, nowMs: Date.parse("2026-06-19T05:01:00.000Z") }
    );

    expect(response.statusCode).toBe(expectedStatus);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("forwards a valid admin request with only server-controlled and safe headers", async () => {
    const env = createEnv();
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ content: [], documents: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            etag: '"snapshot-revision"',
            "x-upstream-private": "must-not-pass"
          }
        })
    );
    const response = createResponse();

    await handleAdminProxyRequest(
      createRequest({
        url: proxyUrl("/api/admin/snapshot"),
        headers: {
          authorization: "Bearer browser-token",
          cookie: await createSessionHeader(env),
          host: "frontend-preview.example.test",
          origin: "https://frontend-preview.example.test",
          referer: "https://frontend-preview.example.test/admin",
          "if-match": '"7"',
          "x-client-secret": "must-not-pass"
        }
      }),
      response,
      { env, fetchImpl, nowMs: Date.parse("2026-06-19T05:01:00.000Z") }
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [upstreamUrl, upstreamInit] = fetchImpl.mock.calls[0];
    const upstreamHeaders = new Headers(upstreamInit.headers);

    expect(upstreamUrl).toBe("https://preview-worker.example.test/api/admin/snapshot");
    expect(upstreamInit).toMatchObject({ method: "GET" });
    expect(upstreamHeaders.get("X-RCAT-Admin-Smoke-Token")).toBe(env.CLOUDFLARE_ADMIN_SMOKE_TOKEN);
    expect(upstreamHeaders.get("If-Match")).toBe('"7"');
    expect(upstreamHeaders.has("Origin")).toBe(false);
    expect(upstreamHeaders.has("Cookie")).toBe(false);
    expect(upstreamHeaders.has("Host")).toBe(false);
    expect(upstreamHeaders.has("Referer")).toBe(false);
    expect(upstreamHeaders.has("Authorization")).toBe(false);
    expect(upstreamHeaders.has("X-Client-Secret")).toBe(false);
    expect(response.statusCode).toBe(200);
    expect(response.getHeader("content-type")).toBe("application/json; charset=utf-8");
    expect(response.getHeader("etag")).toBe('"snapshot-revision"');
    expect(response.getHeader("x-upstream-private")).toBeUndefined();
  });

  it("forwards JSON bodies only for allowed write methods", async () => {
    const env = createEnv();
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ item: { id: "preview-document" } }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
    );
    const response = createResponse();
    const body = JSON.stringify({ title: "Sanitized preview document" });

    await handleAdminProxyRequest(
      createRequest({
        method: "PATCH",
        url: proxyUrl("/api/admin/documents/preview-document"),
        body,
        headers: {
          cookie: await createSessionHeader(env),
          "content-type": "application/json"
        }
      }),
      response,
      { env, fetchImpl, nowMs: Date.parse("2026-06-19T05:01:00.000Z") }
    );

    const [, upstreamInit] = fetchImpl.mock.calls[0];
    expect(upstreamInit.body).toBe(body);
    expect(new Headers(upstreamInit.headers).get("Content-Type")).toBe("application/json");
  });
});

describe("Vercel admin proxy session", () => {
  it("issues a secure HttpOnly cookie only after server-side credential validation", async () => {
    const comparePassword = vi.fn(async () => true);
    const response = createResponse();

    await handleAdminProxySessionLogin(
      createRequest({
        method: "POST",
        url: "/api/admin-proxy-session/login",
        body: { email: ALLOWED_EMAIL, password: "test-password" },
        headers: { "content-type": "application/json" }
      }),
      response,
      {
        env: createEnv(),
        comparePassword,
        nowMs: Date.parse("2026-06-19T05:00:00.000Z")
      }
    );

    expect(response.statusCode).toBe(200);
    expect(comparePassword).toHaveBeenCalledWith("test-password", createEnv().ADMIN_PROXY_PASSWORD_HASH);
    expect(response.getHeader("set-cookie")).toContain(`${getAdminProxySessionCookieName()}=`);
    expect(response.getHeader("set-cookie")).toContain("HttpOnly");
    expect(response.getHeader("set-cookie")).toContain("Secure");
    expect(response.getHeader("set-cookie")).toContain("SameSite=Lax");
    expect(response.bodyText).not.toContain(SESSION_SECRET);
    expect(response.bodyText).not.toContain(createEnv().CLOUDFLARE_ADMIN_SMOKE_TOKEN);
  });

  it("rejects an email outside the server allowlist without revealing it through the password-check path", async () => {
    const comparePassword = vi.fn(async () => true);
    const response = createResponse();

    await handleAdminProxySessionLogin(
      createRequest({
        method: "POST",
        url: "/api/admin-proxy-session/login",
        body: { email: "other@example.test", password: "test-password" }
      }),
      response,
      { env: createEnv(), comparePassword }
    );

    expect(response.statusCode).toBe(401);
    expect(comparePassword).toHaveBeenCalledWith("test-password", createEnv().ADMIN_PROXY_PASSWORD_HASH);
    expect(response.getHeader("set-cookie")).toBeUndefined();
  });

  it("clears the signed session cookie on logout", async () => {
    const response = createResponse();

    await handleAdminProxySessionLogout(
      createRequest({ method: "POST", url: "/api/admin-proxy-session/logout" }),
      response
    );

    expect(response.statusCode).toBe(204);
    expect(response.getHeader("set-cookie")).toContain(`${getAdminProxySessionCookieName()}=`);
    expect(response.getHeader("set-cookie")).toContain("Max-Age=0");
  });
});
