// @vitest-environment node

import { execFileSync } from "node:child_process";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { handleAdminProxyRequest, handleAdminProxySessionLogin, handleAdminProxySessionLogout } from "./handlers.mjs";
import { createLegacyLoginRateLimiter } from "./loginRateLimit.mjs";
import { createAdminProxySessionCookie, getAdminProxySessionCookieName } from "./session.mjs";
import { getCmsCsrfCookieName, getCmsSessionCookieName } from "../cmsAuth/cookies.mjs";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_BROWSER_CSRF_HEADER,
  CMS_CLIENT_IP_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  CMS_USER_AGENT_HEADER
} from "../cmsAuth/handlers.mjs";

const SESSION_SECRET = "fake-admin-proxy-session-secret-32-characters";
const ALLOWED_EMAIL = "admin@example.test";
const EDITOR_EMAIL = "editor@example.invalid";
const CMS_PROXY_SECRET = "test-only-cms-proxy-secret-repeated-000000000000";
const CMS_SESSION_TOKEN = "A".repeat(43);
const CMS_CSRF_TOKEN = "B".repeat(43);

function createEnv(overrides = {}) {
  return {
    ADMIN_PROXY_ALLOWED_EMAILS: ALLOWED_EMAIL,
    ADMIN_PROXY_PASSWORD_HASH: "$2b$04$fake-test-hash-not-used-directly",
    ADMIN_PROXY_SESSION_SECRET: SESSION_SECRET,
    ADMIN_RBAC_ADMINS: ALLOWED_EMAIL,
    ADMIN_RBAC_EDITORS: "",
    ADMIN_RBAC_VIEWERS: "",
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
    role: "admin",
    secret: env.ADMIN_PROXY_SESSION_SECRET,
    nowMs: Date.parse("2026-06-19T05:00:00.000Z")
  });

  return cookie.split(";", 1)[0];
}

async function createRoleSessionHeader(env, email, role) {
  const cookie = await createAdminProxySessionCookie({
    email,
    role,
    secret: env.ADMIN_PROXY_SESSION_SECRET,
    nowMs: Date.parse("2026-06-19T05:00:00.000Z")
  });

  return cookie.split(";", 1)[0];
}

async function createDualSessionHeader(env = createEnv(), options = {}) {
  const legacy = await createSessionHeader(env);
  return [
    legacy,
    `${getCmsSessionCookieName()}=${options.sessionToken ?? CMS_SESSION_TOKEN}`,
    `${getCmsCsrfCookieName()}=${options.csrfToken ?? CMS_CSRF_TOKEN}`
  ].join("; ");
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
          nowMs: Date.parse("2026-06-18T20:00:00.000Z")
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
          "x-rcat-expected-revision": "7",
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
    expect(upstreamHeaders.get("X-RCAT-Expected-Revision")).toBe("7");
    expect(upstreamHeaders.has("If-Match")).toBe(false);
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

  it("forwards a paginated admin query without weakening target-path validation", async () => {
    const env = createEnv();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    const response = createResponse();

    await handleAdminProxyRequest(
      createRequest({
        url: proxyUrl(
          "/api/admin/content?page=2&pageSize=25&q=%E0%B9%84%E0%B8%AD%E0%B8%97%E0%B8%B5%E0%B9%80%E0%B8%AD&status=published"
        ),
        headers: { cookie: await createSessionHeader(env) }
      }),
      response,
      { env, fetchImpl, nowMs: Date.parse("2026-06-19T05:01:00.000Z") }
    );

    expect(response.statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://preview-worker.example.test/api/admin/content?page=2&pageSize=25&q=%E0%B9%84%E0%B8%AD%E0%B8%97%E0%B8%B5%E0%B9%80%E0%B8%AD&status=published",
      expect.objectContaining({ method: "GET" })
    );
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

  it("enforces route-level RBAC before forwarding mutating proxy requests", async () => {
    const env = createEnv({
      ADMIN_PROXY_ALLOWED_EMAILS: `${ALLOWED_EMAIL},${EDITOR_EMAIL},viewer@example.invalid`,
      ADMIN_RBAC_EDITORS: EDITOR_EMAIL,
      ADMIN_RBAC_VIEWERS: "viewer@example.invalid"
    });
    const editorCookie = await createAdminProxySessionCookie({
      email: EDITOR_EMAIL,
      role: "editor",
      secret: env.ADMIN_PROXY_SESSION_SECRET,
      nowMs: Date.parse("2026-06-19T05:00:00.000Z")
    });
    const viewerCookie = await createAdminProxySessionCookie({
      email: "viewer@example.invalid",
      role: "viewer",
      secret: env.ADMIN_PROXY_SESSION_SECRET,
      nowMs: Date.parse("2026-06-19T05:00:00.000Z")
    });
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ content: [], documents: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
    );
    const readResponse = createResponse();
    const editorContentWriteResponse = createResponse();
    const editorSettingsWriteResponse = createResponse();
    const viewerWriteResponse = createResponse();

    await handleAdminProxyRequest(
      createRequest({
        url: proxyUrl("/api/admin/snapshot"),
        headers: { cookie: editorCookie.split(";", 1)[0] }
      }),
      readResponse,
      { env, fetchImpl, nowMs: Date.parse("2026-06-19T05:01:00.000Z") }
    );
    await handleAdminProxyRequest(
      createRequest({
        method: "PATCH",
        url: proxyUrl("/api/admin/content/preview-content"),
        body: { title: "Editor content mutation" },
        headers: {
          cookie: editorCookie.split(";", 1)[0],
          "content-type": "application/json"
        }
      }),
      editorContentWriteResponse,
      { env, fetchImpl, nowMs: Date.parse("2026-06-19T05:01:00.000Z") }
    );
    await handleAdminProxyRequest(
      createRequest({
        method: "PUT",
        url: proxyUrl("/api/admin/settings/site"),
        body: { siteName: "Editor must not mutate settings" },
        headers: {
          cookie: editorCookie.split(";", 1)[0],
          "content-type": "application/json"
        }
      }),
      editorSettingsWriteResponse,
      { env, fetchImpl, nowMs: Date.parse("2026-06-19T05:01:00.000Z") }
    );
    await handleAdminProxyRequest(
      createRequest({
        method: "POST",
        url: proxyUrl("/api/admin/content"),
        body: { title: "Viewer must not mutate" },
        headers: {
          cookie: viewerCookie.split(";", 1)[0],
          "content-type": "application/json"
        }
      }),
      viewerWriteResponse,
      { env, fetchImpl, nowMs: Date.parse("2026-06-19T05:01:00.000Z") }
    );

    expect(readResponse.statusCode).toBe(200);
    expect(editorContentWriteResponse.statusCode).toBe(200);
    expect(editorSettingsWriteResponse.statusCode).toBe(403);
    expect(JSON.parse(editorSettingsWriteResponse.bodyText)).toEqual({
      error: "website settings permission is required"
    });
    expect(viewerWriteResponse.statusCode).toBe(403);
    expect(JSON.parse(viewerWriteResponse.bodyText)).toEqual({ error: "content management permission is required" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("requires an admin role for backup reads before forwarding to the Worker", async () => {
    const env = createEnv({
      ADMIN_PROXY_ALLOWED_EMAILS: `${ALLOWED_EMAIL},${EDITOR_EMAIL}`,
      ADMIN_RBAC_EDITORS: EDITOR_EMAIL
    });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ counts: {} }), { status: 200 }));
    const editorResponse = createResponse();
    const adminResponse = createResponse();

    await handleAdminProxyRequest(
      createRequest({
        url: proxyUrl("/api/admin/backup/download"),
        headers: { cookie: await createRoleSessionHeader(env, EDITOR_EMAIL, "editor") }
      }),
      editorResponse,
      { env, fetchImpl, nowMs: Date.parse("2026-06-19T05:01:00.000Z") }
    );
    await handleAdminProxyRequest(
      createRequest({
        url: proxyUrl("/api/admin/backup/counts"),
        headers: { cookie: await createSessionHeader(env) }
      }),
      adminResponse,
      { env, fetchImpl, nowMs: Date.parse("2026-06-19T05:01:00.000Z") }
    );

    expect(editorResponse.statusCode).toBe(403);
    expect(JSON.parse(editorResponse.bodyText)).toEqual({ error: "admin role is required" });
    expect(adminResponse.statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://preview-worker.example.test/api/admin/backup/counts");
  });

  it("forwards backup attachment headers needed by the browser download flow", async () => {
    const env = createEnv();
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ schemaVersion: 1 }), {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "content-disposition": 'attachment; filename="rcat-d1-backup-preview-2026.json"'
          }
        })
    );
    const response = createResponse();

    await handleAdminProxyRequest(
      createRequest({
        url: proxyUrl("/api/admin/backup/download"),
        headers: { cookie: await createSessionHeader(env) }
      }),
      response,
      { env, fetchImpl, nowMs: Date.parse("2026-06-19T05:01:00.000Z") }
    );

    expect(response.statusCode).toBe(200);
    expect(response.getHeader("content-type")).toBe("application/json; charset=utf-8");
    expect(response.getHeader("content-disposition")).toBe('attachment; filename="rcat-d1-backup-preview-2026.json"');
  });
});

describe("Vercel admin proxy session", () => {
  it("uses a two-hour legacy session without weakening cookie flags", async () => {
    const cookie = await createAdminProxySessionCookie({
      email: ALLOWED_EMAIL,
      secret: SESSION_SECRET,
      nowMs: Date.parse("2026-06-19T05:00:00.000Z")
    });

    expect(cookie).toContain("Max-Age=7200");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });

  it.each([
    ["allowed email configuration", { ADMIN_PROXY_ALLOWED_EMAILS: "" }],
    ["password hash configuration", { ADMIN_PROXY_PASSWORD_HASH: "" }],
    ["session secret configuration", { ADMIN_PROXY_SESSION_SECRET: "" }]
  ])("returns a generic public error when %s is missing", async (_label, overrides) => {
    const env = createEnv(overrides);
    const response = createResponse();

    await handleAdminProxySessionLogin(
      createRequest({
        method: "POST",
        url: "/api/admin-proxy-session/login",
        body: { email: ALLOWED_EMAIL, password: "test-password" }
      }),
      response,
      { env }
    );

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.bodyText)).toEqual({ error: "admin proxy authentication is not configured" });
    expect(response.bodyText).not.toContain("ADMIN_PROXY_");
    expect(response.bodyText).not.toContain(SESSION_SECRET);
    expect(response.bodyText).not.toContain(env.CLOUDFLARE_ADMIN_SMOKE_TOKEN);
    expect(response.bodyText).not.toContain("$2b$04$fake-test-hash-not-used-directly");
  });

  it("validates credentials through the native Node bcryptjs comparison path", () => {
    const script = `
      import { Readable } from "node:stream";
      import bcrypt from "bcryptjs";
      import { handleAdminProxySessionLogin } from "./server/adminProxy/handlers.mjs";

      const password = "test-password";
      const passwordHash = await bcrypt.hash(password, 4);
      const request = Readable.from([JSON.stringify({ email: "admin@example.test", password })]);
      request.method = "POST";
      request.url = "/api/admin-proxy-session/login";
      request.headers = {};

      const headers = new Map();
      let body = Buffer.alloc(0);
      const response = {
        statusCode: 200,
        setHeader(name, value) { headers.set(name.toLowerCase(), value); },
        end(value) { body = value === undefined ? Buffer.alloc(0) : Buffer.from(value); }
      };

      await handleAdminProxySessionLogin(request, response, {
        env: {
          ADMIN_PROXY_ALLOWED_EMAILS: "admin@example.test",
          ADMIN_PROXY_PASSWORD_HASH: passwordHash,
          ADMIN_PROXY_SESSION_SECRET: "fake-admin-proxy-session-secret-32-characters",
          ADMIN_RBAC_ADMINS: "admin@example.test",
          ADMIN_RBAC_EDITORS: "",
          ADMIN_RBAC_VIEWERS: ""
        },
        nowMs: Date.parse("2026-06-19T05:00:00.000Z")
      });

      process.stdout.write(JSON.stringify({
        statusCode: response.statusCode,
        body: body.toString("utf8"),
        hasSessionCookie: headers.has("set-cookie")
      }));
    `;
    const output = execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
      cwd: process.cwd(),
      encoding: "utf8"
    });

    expect(JSON.parse(output)).toEqual({
      statusCode: 200,
      body: JSON.stringify({ ok: true, role: "admin" }),
      hasSessionCookie: true
    });
  });

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
    expect(JSON.parse(response.bodyText)).toEqual({ ok: true, role: "admin" });
    expect(response.getHeader("set-cookie")).toContain(`${getAdminProxySessionCookieName()}=`);
    expect(response.getHeader("set-cookie")).toContain("HttpOnly");
    expect(response.getHeader("set-cookie")).toContain("Secure");
    expect(response.getHeader("set-cookie")).toContain("SameSite=Lax");
    expect(response.bodyText).not.toContain(SESSION_SECRET);
    expect(response.bodyText).not.toContain(createEnv().CLOUDFLARE_ADMIN_SMOKE_TOKEN);
  });

  it("returns the configured Cloudflare RBAC role during login without exposing role maps", async () => {
    const comparePassword = vi.fn(async () => true);
    const response = createResponse();
    const env = createEnv({
      ADMIN_PROXY_ALLOWED_EMAILS: `${ALLOWED_EMAIL},${EDITOR_EMAIL}`,
      ADMIN_RBAC_EDITORS: EDITOR_EMAIL
    });

    await handleAdminProxySessionLogin(
      createRequest({
        method: "POST",
        url: "/api/admin-proxy-session/login",
        body: { email: EDITOR_EMAIL, password: "test-password" },
        headers: { "content-type": "application/json" }
      }),
      response,
      {
        env,
        comparePassword,
        nowMs: Date.parse("2026-06-19T05:00:00.000Z")
      }
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.bodyText)).toEqual({ ok: true, role: "editor" });
    expect(response.bodyText).not.toContain(EDITOR_EMAIL);
    expect(response.bodyText).not.toContain(SESSION_SECRET);
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
    expect(JSON.parse(response.bodyText)).toEqual({ error: "invalid email or password" });
    expect(comparePassword).toHaveBeenCalledWith("test-password", createEnv().ADMIN_PROXY_PASSWORD_HASH);
    expect(response.getHeader("set-cookie")).toBeUndefined();
  });

  it("keeps credential and role failures indistinguishable", async () => {
    const cases = [
      {
        body: { email: ALLOWED_EMAIL, password: "wrong-password" },
        comparePassword: vi.fn(async () => false),
        env: createEnv()
      },
      {
        body: { email: ALLOWED_EMAIL, password: "test-password" },
        comparePassword: vi.fn(async () => true),
        env: createEnv({ ADMIN_RBAC_ADMINS: "" })
      },
      {
        body: { email: ALLOWED_EMAIL, password: "test-password" },
        comparePassword: vi.fn(async () => true),
        env: createEnv({ ADMIN_RBAC_EDITORS: ALLOWED_EMAIL })
      },
      {
        body: { email: ALLOWED_EMAIL, password: "test-password" },
        comparePassword: vi.fn(async () => true),
        env: createEnv({ ADMIN_RBAC_ADMINS: "malformed-role-assignment" })
      }
    ];

    for (const testCase of cases) {
      const response = createResponse();

      await handleAdminProxySessionLogin(
        createRequest({
          method: "POST",
          url: "/api/admin-proxy-session/login",
          body: testCase.body,
          headers: { "x-vercel-forwarded-for": "192.0.2.10" }
        }),
        response,
        {
          env: testCase.env,
          comparePassword: testCase.comparePassword,
          loginLimiter: createLegacyLoginRateLimiter(),
          nowMs: Date.parse("2026-06-19T05:00:00.000Z")
        }
      );

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.bodyText)).toEqual({ error: "invalid email or password" });
      expect(response.getHeader("set-cookie")).toBeUndefined();
    }
  });

  it("blocks the fifth identity failure and skips bcrypt while the block is active", async () => {
    const loginLimiter = createLegacyLoginRateLimiter();
    const comparePassword = vi.fn(async () => false);
    const nowMs = Date.parse("2026-06-19T05:00:00.000Z");
    const responses = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = createResponse();
      responses.push(response);

      await handleAdminProxySessionLogin(
        createRequest({
          method: "POST",
          url: "/api/admin-proxy-session/login",
          body: { email: ALLOWED_EMAIL, password: "wrong-password" },
          headers: { "x-vercel-forwarded-for": "192.0.2.20" }
        }),
        response,
        { env: createEnv(), comparePassword, loginLimiter, nowMs }
      );
    }

    expect(responses.slice(0, 4).map((response) => response.statusCode)).toEqual([401, 401, 401, 401]);
    expect(responses[4].statusCode).toBe(429);
    expect(responses[5].statusCode).toBe(429);
    expect(responses[5].getHeader("retry-after")).toBe("900");
    expect(JSON.parse(responses[5].bodyText)).toEqual({
      error: "too many login attempts",
      retryAfterSeconds: 900
    });
    expect(comparePassword).toHaveBeenCalledTimes(5);
  });

  it("counts malformed JSON against IP abuse protection without invoking bcrypt", async () => {
    const loginLimiter = createLegacyLoginRateLimiter({ maxFailuresPerIp: 2 });
    const comparePassword = vi.fn();
    const responses = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = createResponse();
      responses.push(response);

      await handleAdminProxySessionLogin(
        createRequest({
          method: "POST",
          url: "/api/admin-proxy-session/login",
          body: "{",
          headers: { "x-forwarded-for": "198.51.100.10" }
        }),
        response,
        {
          env: createEnv(),
          comparePassword,
          loginLimiter,
          nowMs: Date.parse("2026-06-19T05:00:00.000Z")
        }
      );
    }

    expect(responses.map((response) => response.statusCode)).toEqual([400, 429, 429]);
    expect(comparePassword).not.toHaveBeenCalled();
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

describe("Vercel admin proxy CMS Session compatibility", () => {
  function cmsEnv(overrides = {}) {
    return createEnv({
      CMS_AUTH_ENABLED: "true",
      CMS_AUTH_PROXY_SECRET: CMS_PROXY_SECRET,
      ...overrides
    });
  }

  it("uses only CMS private headers when the CMS cookie is present", async () => {
    const env = cmsEnv();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    const response = createResponse();

    await handleAdminProxyRequest(
      createRequest({
        url: proxyUrl("/api/admin/settings/site"),
        headers: {
          cookie: await createDualSessionHeader(env),
          "x-vercel-forwarded-for": "192.0.2.44",
          "user-agent": "cms-proxy-test",
          "x-rcat-admin-proxy-email": "attacker@example.invalid",
          "x-rcat-admin-proxy-role": "admin",
          "x-rcat-admin-smoke-token": "browser-smoke",
          [CMS_AUTH_PROXY_SECRET_HEADER]: "browser-secret"
        }
      }),
      response,
      { env, fetchImpl }
    );

    const headers = new Headers(fetchImpl.mock.calls[0][1].headers);
    expect(headers.get(CMS_AUTH_PROXY_SECRET_HEADER)).toBe(CMS_PROXY_SECRET);
    expect(headers.get(CMS_SESSION_TOKEN_HEADER)).toBe(CMS_SESSION_TOKEN);
    expect(headers.get(CMS_CLIENT_IP_HEADER)).toBe("192.0.2.44");
    expect(headers.get(CMS_USER_AGENT_HEADER)).toBe("cms-proxy-test");
    expect(headers.has("X-RCAT-Admin-Smoke-Token")).toBe(false);
    expect(headers.has("X-RCAT-Admin-Proxy-Email")).toBe(false);
    expect(headers.has("X-RCAT-Admin-Proxy-Role")).toBe(false);
    expect(headers.has(CMS_CSRF_TOKEN_HEADER)).toBe(false);
    expect(response.statusCode).toBe(200);
    expect(response.getHeader("cache-control")).toBe("no-store");
    expect(response.bodyText).not.toContain(CMS_PROXY_SECRET);
  });

  it("does not perform local role authorization for CMS Sessions", async () => {
    const env = cmsEnv();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const response = createResponse();

    await handleAdminProxyRequest(
      createRequest({
        method: "PUT",
        url: proxyUrl("/api/admin/settings/site"),
        body: { siteName: "Worker decides current role" },
        headers: {
          cookie: await createDualSessionHeader(env),
          "content-type": "application/json",
          [CMS_BROWSER_CSRF_HEADER]: CMS_CSRF_TOKEN
        }
      }),
      response,
      { env, fetchImpl }
    );

    expect(response.statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const headers = new Headers(fetchImpl.mock.calls[0][1].headers);
    expect(headers.get(CMS_CSRF_TOKEN_HEADER)).toBe(CMS_CSRF_TOKEN);
  });

  it.each([
    ["missing CSRF header", {}, CMS_CSRF_TOKEN],
    ["missing CSRF cookie", { [CMS_BROWSER_CSRF_HEADER]: CMS_CSRF_TOKEN }, ""],
    ["CSRF mismatch", { [CMS_BROWSER_CSRF_HEADER]: "C".repeat(43) }, CMS_CSRF_TOKEN]
  ])("rejects a CMS mutation with %s before Worker fetch", async (_label, headers, cookieCsrf) => {
    const env = cmsEnv();
    const fetchImpl = vi.fn();
    const response = createResponse();
    const cookie = await createDualSessionHeader(env, { csrfToken: cookieCsrf });

    await handleAdminProxyRequest(
      createRequest({
        method: "POST",
        url: proxyUrl("/api/admin/content"),
        body: { title: "blocked" },
        headers: { cookie, "content-type": "application/json", ...headers }
      }),
      response,
      { env, fetchImpl }
    );

    expect(response.statusCode).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never falls back to the valid legacy Session after an invalid CMS upstream response", async () => {
    const env = cmsEnv();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "invalid" }), { status: 401 }));
    const response = createResponse();

    await handleAdminProxyRequest(
      createRequest({
        url: proxyUrl("/api/admin/snapshot"),
        headers: { cookie: await createDualSessionHeader(env) }
      }),
      response,
      { env, fetchImpl }
    );

    expect(response.statusCode).toBe(401);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const headers = new Headers(fetchImpl.mock.calls[0][1].headers);
    expect(headers.has("X-RCAT-Admin-Smoke-Token")).toBe(false);
  });

  it("fails closed instead of using the legacy Session for malformed or disabled CMS cookies", async () => {
    const configured = cmsEnv();
    const malformedResponse = createResponse();
    const disabledResponse = createResponse();
    const fetchImpl = vi.fn();

    await handleAdminProxyRequest(
      createRequest({
        url: proxyUrl("/api/admin/snapshot"),
        headers: { cookie: await createDualSessionHeader(configured, { sessionToken: "short" }) }
      }),
      malformedResponse,
      { env: configured, fetchImpl }
    );
    await handleAdminProxyRequest(
      createRequest({
        url: proxyUrl("/api/admin/snapshot"),
        headers: { cookie: await createDualSessionHeader(configured) }
      }),
      disabledResponse,
      { env: cmsEnv({ CMS_AUTH_ENABLED: "false" }), fetchImpl }
    );

    expect(malformedResponse.statusCode).toBe(401);
    expect(disabledResponse.statusCode).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
