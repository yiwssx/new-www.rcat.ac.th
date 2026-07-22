// @vitest-environment node
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_BROWSER_CSRF_HEADER,
  CMS_CLIENT_IP_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_NEW_CSRF_TOKEN_HEADER,
  CMS_NEW_SESSION_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  CMS_USER_AGENT_HEADER,
  createCmsLifecycleRateLimiter,
  createCmsLoginRateLimiter,
  handleCmsAuthLogin,
  handleCmsInvitationAccept,
  handleCmsInvitationInspect,
  handleCmsAuthLogout,
  handleCmsAuthLogoutAll,
  handleCmsPasswordResetComplete,
  handleCmsPasswordResetInspect,
  handleCmsAuthSession
} from "./handlers.mjs";
import {
  createCmsAuthCookies,
  getCmsCsrfCookieName,
  getCmsSessionCookieName,
  readCmsCsrfCookie,
  readCmsSessionCookie
} from "./cookies.mjs";

const proxySecret = "test-only-cms-proxy-secret-repeated-000000000000";
const sessionToken = "A".repeat(43);
const csrfToken = "B".repeat(43);
const legacyCookie = "__Host-rcat_admin_proxy_session=legacy-value";
const safeUser = {
  id: "admin-user-1",
  email: "admin@example.invalid",
  name: "Admin User",
  username: "admin.user",
  role: "admin",
  isRoot: true,
  sessionId: "admin-session-1",
  sessionVersion: 3
};

function env(overrides = {}) {
  return {
    CMS_AUTH_ENABLED: "true",
    CMS_AUTH_PROXY_SECRET: proxySecret,
    CLOUDFLARE_ADMIN_API_URL: "https://worker.example.invalid",
    ...overrides
  };
}

function request({ body, headers = {}, method = "GET", url = "/" } = {}) {
  const stream = Readable.from(body === undefined ? [] : [typeof body === "string" ? body : JSON.stringify(body)]);
  stream.method = method;
  stream.url = url;
  stream.headers = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
  return stream;
}

function response() {
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

function workerSuccess(options = {}) {
  return new Response(JSON.stringify({ ok: true, user: safeUser, ...options.body }), {
    status: options.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      [CMS_NEW_SESSION_TOKEN_HEADER]: options.sessionToken ?? sessionToken,
      [CMS_NEW_CSRF_TOKEN_HEADER]: options.csrfToken ?? csrfToken,
      "X-Worker-Private": "must-not-forward"
    }
  });
}

function cmsCookieHeader(options = {}) {
  return [
    `${getCmsSessionCookieName()}=${options.sessionToken ?? sessionToken}`,
    `${getCmsCsrfCookieName()}=${options.csrfToken ?? csrfToken}`,
    legacyCookie
  ].join("; ");
}

describe("Vercel CMS-auth handlers", () => {
  it("parses exact cookie names without percent-decoding and rejects duplicates or malformed token lengths", () => {
    const valid = `${getCmsSessionCookieName()}=${sessionToken}; ${getCmsCsrfCookieName()}=${csrfToken}`;
    const duplicate = `${valid}; ${getCmsSessionCookieName()}=${sessionToken}`;
    const prefixed = `prefix-${getCmsSessionCookieName()}=${sessionToken}`;
    const encoded = `${getCmsSessionCookieName()}=${encodeURIComponent(sessionToken + "=")}`;

    expect(readCmsSessionCookie(valid)).toBe(sessionToken);
    expect(readCmsCsrfCookie(valid)).toBe(csrfToken);
    expect(readCmsSessionCookie(duplicate)).toBe("");
    expect(readCmsSessionCookie(prefixed)).toBe("");
    expect(readCmsSessionCookie(encoded)).toBe("");
    expect(() => createCmsAuthCookies("short", csrfToken)).toThrow("invalid CMS cookie token");
  });

  it("requires POST for Login and rejects cross-origin browser Login", async () => {
    const methodResponse = response();
    const originResponse = response();

    await handleCmsAuthLogin(request(), methodResponse, { env: env() });
    await handleCmsAuthLogin(
      request({
        method: "POST",
        body: {},
        headers: { host: "admin.example.invalid", origin: "https://attacker.example.invalid" }
      }),
      originResponse,
      { env: env() }
    );

    expect(methodResponse.statusCode).toBe(405);
    expect(originResponse.statusCode).toBe(403);
  });

  it.each([
    ["disabled", { CMS_AUTH_ENABLED: "false" }],
    ["missing secret", { CMS_AUTH_PROXY_SECRET: "" }],
    ["invalid Worker URL", { CLOUDFLARE_ADMIN_API_URL: "http://worker.example.invalid/path?secret=x" }]
  ])("returns generic 503 when CMS auth is %s", async (_label, overrides) => {
    const result = response();
    await handleCmsAuthLogin(request({ method: "POST", body: {} }), result, { env: env(overrides) });

    expect(result.statusCode).toBe(503);
    expect(result.bodyText).not.toMatch(/CMS_AUTH_|CLOUDFLARE_|test-only|worker\.example/);
  });

  it("rejects malformed and oversized Login bodies", async () => {
    const malformed = response();
    const oversized = response();

    await handleCmsAuthLogin(request({ method: "POST", body: "{" }), malformed, {
      env: env(),
      loginLimiter: createCmsLoginRateLimiter()
    });
    await handleCmsAuthLogin(request({ method: "POST", body: "x".repeat(16 * 1024 + 1) }), oversized, {
      env: env(),
      loginLimiter: createCmsLoginRateLimiter()
    });

    expect(malformed.statusCode).toBe(400);
    expect(oversized.statusCode).toBe(413);
  });

  it("normalizes only the identifier, preserves password bytes, overwrites private headers, and sanitizes metadata", async () => {
    const fetchImpl = vi.fn(async () => workerSuccess());
    const result = response();

    await handleCmsAuthLogin(
      request({
        method: "POST",
        body: { identifier: "  ADMIN.User  ", password: " exact password " },
        headers: {
          [CMS_AUTH_PROXY_SECRET_HEADER]: "browser-secret",
          [CMS_SESSION_TOKEN_HEADER]: "browser-session",
          "x-vercel-forwarded-for": "192.0.2.10, 198.51.100.1",
          "user-agent": "test-browser/1.0"
        }
      }),
      result,
      { env: env(), fetchImpl, loginLimiter: createCmsLoginRateLimiter() }
    );

    const [, init] = fetchImpl.mock.calls[0];
    const forwardedBody = JSON.parse(init.body);
    const headers = new Headers(init.headers);

    expect(forwardedBody).toEqual({ identifier: "admin.user", password: " exact password " });
    expect(headers.get(CMS_AUTH_PROXY_SECRET_HEADER)).toBe(proxySecret);
    expect(headers.get(CMS_SESSION_TOKEN_HEADER)).toBeNull();
    expect(headers.get(CMS_CLIENT_IP_HEADER)).toBe("192.0.2.10");
    expect(headers.get(CMS_USER_AGENT_HEADER)).toBe("test-browser/1.0");
  });

  it("bounds malformed IP and User-Agent metadata without forwarding raw values", async () => {
    const fetchImpl = vi.fn(async () => workerSuccess());
    const result = response();

    await handleCmsAuthLogin(
      request({
        method: "POST",
        body: { identifier: "admin", password: "password" },
        headers: { "x-forwarded-for": "not-an-ip", "user-agent": `bad${String.fromCharCode(1)}agent` }
      }),
      result,
      { env: env(), fetchImpl, loginLimiter: createCmsLoginRateLimiter() }
    );

    const headers = new Headers(fetchImpl.mock.calls[0][1].headers);
    expect(headers.get(CMS_CLIENT_IP_HEADER)).toBe("unknown");
    expect(headers.get(CMS_USER_AGENT_HEADER)).toBe("unknown");
  });

  it("blocks locally without calling the Worker and retains IP-wide history after success", async () => {
    const limiter = createCmsLoginRateLimiter({ identifierLimit: 1 });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "invalid" }), { status: 401 }));
    const first = response();
    const blocked = response();
    const input = request({
      method: "POST",
      body: { identifier: "admin", password: "wrong" },
      headers: { "x-real-ip": "192.0.2.20" }
    });

    await handleCmsAuthLogin(input, first, { env: env(), fetchImpl, loginLimiter: limiter, nowMs: 1_000 });
    await handleCmsAuthLogin(
      request({
        method: "POST",
        body: { identifier: "admin", password: "wrong" },
        headers: { "x-real-ip": "192.0.2.20" }
      }),
      blocked,
      { env: env(), fetchImpl, loginLimiter: limiter, nowMs: 1_000 }
    );

    expect(first.statusCode).toBe(429);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.getHeader("retry-after")).toBe("900");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("sets exactly two hardened cookies and exposes no private Worker headers or raw tokens", async () => {
    const result = response();
    await handleCmsAuthLogin(request({ method: "POST", body: { identifier: "admin", password: "password" } }), result, {
      env: env(),
      fetchImpl: vi.fn(async () => workerSuccess()),
      loginLimiter: createCmsLoginRateLimiter()
    });

    const cookies = result.getHeader("set-cookie");
    expect(result.statusCode).toBe(200);
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain(`${getCmsSessionCookieName()}=`);
    expect(cookies[0]).toContain("HttpOnly");
    expect(cookies[1]).toContain(`${getCmsCsrfCookieName()}=`);
    expect(cookies[1]).not.toContain("HttpOnly");
    for (const cookie of cookies) {
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Strict");
      expect(cookie).toContain("Max-Age=28800");
      expect(cookie).not.toContain("Domain=");
    }
    expect(result.bodyText).not.toContain(sessionToken);
    expect(result.bodyText).not.toContain(csrfToken);
    expect(result.getHeader("x-worker-private")).toBeUndefined();
  });

  it.each([
    ["missing Session", "", csrfToken],
    ["malformed Session", "short", csrfToken],
    ["missing CSRF", sessionToken, ""],
    ["malformed CSRF", sessionToken, "short"]
  ])("returns 502 and sets no cookies for %s private response header", async (_label, newSession, newCsrf) => {
    const result = response();
    await handleCmsAuthLogin(request({ method: "POST", body: { identifier: "admin", password: "password" } }), result, {
      env: env(),
      fetchImpl: vi.fn(async () => workerSuccess({ sessionToken: newSession, csrfToken: newCsrf })),
      loginLimiter: createCmsLoginRateLimiter()
    });
    expect(result.statusCode).toBe(502);
    expect(result.getHeader("set-cookie")).toBeUndefined();
  });

  it("Session forwards only the HttpOnly Session token and returns safe user JSON", async () => {
    const fetchImpl = vi.fn(async () => workerSuccess());
    const result = response();
    await handleCmsAuthSession(
      request({ method: "GET", headers: { cookie: cmsCookieHeader(), [CMS_BROWSER_CSRF_HEADER]: csrfToken } }),
      result,
      { env: env(), fetchImpl }
    );

    const headers = new Headers(fetchImpl.mock.calls[0][1].headers);
    expect(headers.get(CMS_SESSION_TOKEN_HEADER)).toBe(sessionToken);
    expect(headers.get(CMS_CSRF_TOKEN_HEADER)).toBeNull();
    expect(result.statusCode).toBe(200);
    expect(result.bodyText).not.toContain(sessionToken);
    expect(result.bodyText).not.toContain(csrfToken);
  });

  it("Logout requires matching CSRF, clears both CMS cookies even for invalid upstream Session, and keeps legacy cookie", async () => {
    const mismatchFetch = vi.fn();
    const mismatch = response();
    const invalid = response();

    await handleCmsAuthLogout(
      request({
        method: "POST",
        headers: { cookie: cmsCookieHeader(), [CMS_BROWSER_CSRF_HEADER]: "C".repeat(43) }
      }),
      mismatch,
      { env: env(), fetchImpl: mismatchFetch }
    );
    await handleCmsAuthLogout(
      request({ method: "POST", headers: { cookie: cmsCookieHeader(), [CMS_BROWSER_CSRF_HEADER]: csrfToken } }),
      invalid,
      { env: env(), fetchImpl: vi.fn(async () => new Response(null, { status: 401 })) }
    );

    expect(mismatch.statusCode).toBe(403);
    expect(mismatchFetch).not.toHaveBeenCalled();
    expect(invalid.statusCode).toBe(401);
    for (const cookie of invalid.getHeader("set-cookie")) {
      expect(cookie).toContain("Max-Age=0");
      expect(cookie).not.toContain("rcat_admin_proxy_session");
    }
  });

  it("Logout and logout-all forward CSRF privately and clear both CMS cookies on success", async () => {
    for (const handler of [handleCmsAuthLogout, handleCmsAuthLogoutAll]) {
      const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
      const result = response();
      await handler(
        request({ method: "POST", headers: { cookie: cmsCookieHeader(), [CMS_BROWSER_CSRF_HEADER]: csrfToken } }),
        result,
        { env: env(), fetchImpl }
      );

      const headers = new Headers(fetchImpl.mock.calls[0][1].headers);
      expect(headers.get(CMS_SESSION_TOKEN_HEADER)).toBe(sessionToken);
      expect(headers.get(CMS_CSRF_TOKEN_HEADER)).toBe(csrfToken);
      expect(result.statusCode).toBe(204);
      expect(result.getHeader("set-cookie")).toHaveLength(2);
      expect(String(result.getHeader("set-cookie"))).not.toContain("rcat_admin_proxy_session");
    }
  });

  it("accepts lifecycle tokens only in POST JSON bodies and rejects token query strings", async () => {
    const fetchImpl = vi.fn();
    const query = response();
    const method = response();
    await handleCmsInvitationInspect(
      request({ method: "POST", url: `/api/cms-auth/invitation/inspect?token=${sessionToken}` }),
      query,
      {
        env: env(),
        fetchImpl,
        lifecycleLimiter: createCmsLifecycleRateLimiter()
      }
    );
    await handleCmsInvitationInspect(request({ method: "GET", body: { token: sessionToken } }), method, {
      env: env(),
      fetchImpl,
      lifecycleLimiter: createCmsLifecycleRateLimiter()
    });
    expect(query.statusCode).toBe(400);
    expect(method.statusCode).toBe(405);
    expect(query.bodyText).not.toContain(sessionToken);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects cross-origin, malformed, and oversized lifecycle bodies without calling the Worker", async () => {
    for (const [headers, body, expected] of [
      [{ origin: "https://evil.example", host: "cms.example" }, { token: sessionToken }, 403],
      [{}, "{", 400],
      [{}, "x".repeat(16 * 1024 + 1), 413]
    ]) {
      const fetchImpl = vi.fn();
      const result = response();
      await handleCmsPasswordResetInspect(request({ method: "POST", headers, body }), result, {
        env: env(),
        fetchImpl,
        lifecycleLimiter: createCmsLifecycleRateLimiter()
      });
      expect(result.statusCode).toBe(expected);
      expect(result.getHeader("cache-control")).toBe("no-store");
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("overwrites private headers, sanitizes metadata, and never returns the token or Worker-private headers", async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      const headers = new Headers(init.headers);
      expect(headers.get(CMS_AUTH_PROXY_SECRET_HEADER)).toBe(proxySecret);
      expect(headers.get(CMS_CLIENT_IP_HEADER)).toBe("unknown");
      expect(headers.get(CMS_USER_AGENT_HEADER)).toBe("unknown");
      return new Response(
        JSON.stringify({
          valid: true,
          user: { email: "u@example.test", name: "User", role: "viewer", username: null },
          expiresAt: "2026-07-25T00:00:00.000Z"
        }),
        { status: 200, headers: { "Content-Type": "application/json", "X-Worker-Private": "hidden" } }
      );
    });
    const result = response();
    await handleCmsInvitationInspect(
      request({
        method: "POST",
        body: { token: sessionToken },
        headers: {
          [CMS_AUTH_PROXY_SECRET_HEADER]: "attacker-value",
          "x-forwarded-for": "not-an-ip",
          "user-agent": "bad\u0001agent"
        }
      }),
      result,
      { env: env(), fetchImpl, lifecycleLimiter: createCmsLifecycleRateLimiter() }
    );
    expect(result.statusCode).toBe(200);
    expect(result.bodyText).not.toContain(sessionToken);
    expect(result.bodyText).not.toContain(proxySecret);
    expect(result.getHeader("x-worker-private")).toBeUndefined();
    expect(result.getHeader("cache-control")).toBe("no-store");
  });

  it("blocks rate-limited lifecycle requests before Worker fetch and keeps invalid-link errors generic", async () => {
    const blockedFetch = vi.fn();
    const blocked = response();
    await handleCmsInvitationAccept(
      request({
        method: "POST",
        body: {
          token: sessionToken,
          password: "a long replacement password",
          passwordConfirmation: "a long replacement password"
        }
      }),
      blocked,
      {
        env: env(),
        fetchImpl: blockedFetch,
        lifecycleLimiter: createCmsLifecycleRateLimiter({ attemptLimit: 0 }),
        nowMs: 1000
      }
    );
    expect(blocked.statusCode).toBe(429);
    expect(blockedFetch).not.toHaveBeenCalled();

    for (const handler of [handleCmsInvitationAccept, handleCmsPasswordResetComplete]) {
      const result = response();
      await handler(
        request({
          method: "POST",
          body: {
            token: sessionToken,
            password: "a long replacement password",
            passwordConfirmation: "a long replacement password"
          }
        }),
        result,
        {
          env: env(),
          lifecycleLimiter: createCmsLifecycleRateLimiter(),
          fetchImpl: vi.fn(
            async () =>
              new Response(
                JSON.stringify({
                  error:
                    handler === handleCmsInvitationAccept
                      ? "invitation is invalid or expired"
                      : "password-reset link is invalid or expired"
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              )
          )
        }
      );
      expect(result.statusCode).toBe(400);
      expect(result.bodyText).not.toContain(sessionToken);
      expect(result.getHeader("cache-control")).toBe("no-store");
    }
  });
});
