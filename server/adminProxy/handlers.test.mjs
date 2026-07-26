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
import { handleAdminProxyRequest } from "./handlers.mjs";

const CMS_PROXY_SECRET = "test-only-cms-proxy-secret-repeated-000000000000";
const CMS_SESSION_TOKEN = "A".repeat(43);
const CMS_CSRF_TOKEN = "B".repeat(43);
const OBSOLETE_COOKIE = "__Host-rcat_admin_proxy_session=obsolete-value";

function createEnv(overrides = {}) {
  return {
    CLOUDFLARE_ADMIN_API_URL: "https://preview-worker.example.test",
    CMS_AUTH_PROXY_SECRET: CMS_PROXY_SECRET,
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

function cmsCookie({ csrfToken = "", sessionToken = CMS_SESSION_TOKEN, extras = [] } = {}) {
  return [
    `${getCmsSessionCookieName()}=${sessionToken}`,
    ...(csrfToken ? [`${getCmsCsrfCookieName()}=${csrfToken}`] : []),
    ...extras
  ].join("; ");
}

function successfulWorker(payload = { ok: true }) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          etag: '"worker-revision"',
          "x-private-header": "must-not-pass"
        }
      })
  );
}

async function callProxy({
  body,
  env = createEnv(),
  fetchImpl = successfulWorker(),
  headers = {},
  method = "GET",
  path = "/api/admin/snapshot"
} = {}) {
  const response = createResponse();
  await handleAdminProxyRequest(
    createRequest({
      body,
      headers,
      method,
      url: proxyUrl(path)
    }),
    response,
    { env, fetchImpl }
  );
  return { response, fetchImpl };
}

describe("CMS-only Vercel admin proxy", () => {
  it("forwards a valid CMS GET with only CMS identity and safe request headers", async () => {
    const { response, fetchImpl } = await callProxy({
      headers: {
        authorization: "Bearer ignored",
        cookie: cmsCookie(),
        host: "cms.example.test",
        origin: "https://cms.example.test",
        "user-agent": "test-agent",
        "x-forwarded-for": "203.0.113.10",
        "x-rcat-admin-proxy-email": "attacker@example.invalid",
        "x-rcat-admin-proxy-role": "admin",
        "x-rcat-admin-smoke-token": "ignored",
        "x-rcat-expected-revision": "7"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.getHeader("etag")).toBe('"worker-revision"');
    expect(response.getHeader("x-private-header")).toBeUndefined();
    expect(response.getHeader("set-cookie")).toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://preview-worker.example.test/api/admin/snapshot");
    expect(init.method).toBe("GET");
    expect(init.headers.get(CMS_AUTH_PROXY_SECRET_HEADER)).toBe(CMS_PROXY_SECRET);
    expect(init.headers.get(CMS_SESSION_TOKEN_HEADER)).toBe(CMS_SESSION_TOKEN);
    expect(init.headers.get(CMS_CLIENT_IP_HEADER)).toBe("203.0.113.10");
    expect(init.headers.get(CMS_USER_AGENT_HEADER)).toBe("test-agent");
    expect(init.headers.get("X-RCAT-Expected-Revision")).toBe("7");
    expect(init.headers.get(CMS_CSRF_TOKEN_HEADER)).toBeNull();
    expect(init.headers.get("Authorization")).toBeNull();
    expect(init.headers.get("X-RCAT-Admin-Smoke-Token")).toBeNull();
    expect(init.headers.get("X-RCAT-Admin-Proxy-Email")).toBeNull();
    expect(init.headers.get("X-RCAT-Admin-Proxy-Role")).toBeNull();
  });

  it("forwards a valid CMS mutation only with exact CSRF", async () => {
    const body = { title: "Updated" };
    const { response, fetchImpl } = await callProxy({
      body,
      method: "PATCH",
      path: "/api/admin/content/item-1",
      headers: {
        cookie: cmsCookie({ csrfToken: CMS_CSRF_TOKEN }),
        [CMS_BROWSER_CSRF_HEADER]: CMS_CSRF_TOKEN,
        "content-type": "application/json"
      }
    });

    expect(response.statusCode).toBe(200);
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.get(CMS_CSRF_TOKEN_HEADER)).toBe(CMS_CSRF_TOKEN);
    expect(init.body).toBe(JSON.stringify(body));
  });

  it.each([
    ["missing", ""],
    ["malformed", "not-a-token"],
    ["different", "C".repeat(43)]
  ])("rejects a CMS mutation with %s CSRF", async (_label, headerToken) => {
    const { response, fetchImpl } = await callProxy({
      body: { title: "Blocked" },
      method: "POST",
      headers: {
        cookie: cmsCookie({ csrfToken: CMS_CSRF_TOKEN }),
        ...(headerToken ? { [CMS_BROWSER_CSRF_HEADER]: headerToken } : {})
      }
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.bodyText)).toEqual({ error: "CSRF validation failed" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("requires a CMS Session and ignores old identity headers", async () => {
    const { response, fetchImpl } = await callProxy({
      headers: {
        "x-rcat-admin-smoke-token": "ignored",
        "x-rcat-admin-proxy-email": "attacker@example.invalid",
        "x-rcat-admin-proxy-role": "admin"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.bodyText)).toEqual({ error: "CMS session is required" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed", cmsCookie({ sessionToken: "malformed" })],
    ["duplicate", `${cmsCookie()}; ${getCmsSessionCookieName()}=${"C".repeat(43)}`]
  ])("fails closed for a %s CMS Session cookie", async (_label, cookie) => {
    const { response, fetchImpl } = await callProxy({ headers: { cookie } });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.bodyText)).toEqual({ error: "CMS session is invalid or expired" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["obsolete cookie", OBSOLETE_COOKIE],
    ["malformed obsolete cookie", "__Host-rcat_admin_proxy_session=%broken"]
  ])("does not authenticate an %s alone", async (_label, cookie) => {
    const { response, fetchImpl } = await callProxy({ headers: { cookie } });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.bodyText)).toEqual({ error: "CMS session is required" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([OBSOLETE_COOKIE, "__Host-rcat_admin_proxy_session=%broken"])(
    "ignores an inert old cookie when the CMS Session is valid",
    async (obsoleteCookie) => {
      const { response, fetchImpl } = await callProxy({
        headers: { cookie: cmsCookie({ extras: [obsoleteCookie] }) }
      });

      expect(response.statusCode).toBe(200);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(response.getHeader("set-cookie")).toBeUndefined();
    }
  );

  it.each([
    ["missing", null],
    ["absolute URL", "https://attacker.example.test/api/admin/snapshot"],
    ["path traversal", "/api/admin/../public/documents"],
    ["encoded traversal", "/api/admin/%2e%2e/public/documents"],
    ["multiply encoded traversal", "/api/admin/%25252e%25252e/public/documents"],
    ["non-admin path", "/api/public/documents"]
  ])("rejects an invalid %s target before the Worker", async (_label, path) => {
    const { response, fetchImpl } = await callProxy({
      headers: { cookie: cmsCookie() },
      path
    });

    expect(response.statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests before authentication or upstream work", async () => {
    const { response, fetchImpl } = await callProxy({
      headers: {
        cookie: cmsCookie(),
        host: "cms.example.test",
        origin: "https://attacker.example.test"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed when CMS configuration is missing", async () => {
    const { response, fetchImpl } = await callProxy({
      env: createEnv({ CMS_AUTH_PROXY_SECRET: "" }),
      headers: { cookie: cmsCookie() }
    });

    expect(response.statusCode).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps an upstream 401 to the finite invalid-or-expired Session response", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ error: "private upstream detail" }, { status: 401 }));
    const { response } = await callProxy({
      fetchImpl,
      headers: { cookie: cmsCookie() }
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.bodyText)).toEqual({ error: "CMS session is invalid or expired" });
  });

  it("enforces the request body limit", async () => {
    const { response, fetchImpl } = await callProxy({
      body: "x".repeat(1024 * 1024 + 1),
      method: "POST",
      headers: {
        cookie: cmsCookie({ csrfToken: CMS_CSRF_TOKEN }),
        [CMS_BROWSER_CSRF_HEADER]: CMS_CSRF_TOKEN
      }
    });

    expect(response.statusCode).toBe(413);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
