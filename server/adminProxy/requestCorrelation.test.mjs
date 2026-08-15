// @vitest-environment node

import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { getCmsSessionCookieName } from "../cmsAuth/cookies.mjs";
import { RCAT_REQUEST_ID_HEADER } from "../observability/requestId.mjs";
import { handleAdminProxyRequest } from "./handlers.mjs";

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";
const CMS_PROXY_SECRET = "test-only-cms-proxy-secret-repeated-000000000000";
const CMS_SESSION_TOKEN = "A".repeat(43);

function createRequest(path = "/api/admin/snapshot") {
  const request = Readable.from([]);
  request.method = "GET";
  request.url = `/api/admin-proxy?path=${encodeURIComponent(path)}`;
  request.headers = {
    cookie: `${getCmsSessionCookieName()}=${CMS_SESSION_TOKEN}`,
    host: "cms.example.test",
    origin: "https://cms.example.test",
    "user-agent": "request-correlation-test",
    "x-forwarded-for": "203.0.113.10"
  };
  return request;
}

function createResponse() {
  const headers = new Map();
  let body = "";

  return {
    headersSent: false,
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    write(value) {
      this.headersSent = true;
      body += Buffer.from(value).toString("utf8");
      return true;
    },
    end(value) {
      if (value !== undefined) body += Buffer.from(value).toString("utf8");
      this.headersSent = true;
    },
    get bodyText() {
      return body;
    }
  };
}

function createEnv() {
  return {
    CLOUDFLARE_ADMIN_API_URL: "https://preview-worker.example.test",
    CMS_AUTH_PROXY_SECRET: CMS_PROXY_SECRET
  };
}

describe("Admin proxy request correlation", () => {
  it("uses one server-generated ID for the browser response and Worker request", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    const response = createResponse();

    await handleAdminProxyRequest(createRequest(), response, {
      createRequestId: () => REQUEST_ID,
      env: createEnv(),
      fetchImpl
    });

    expect(response.statusCode).toBe(200);
    expect(response.getHeader(RCAT_REQUEST_ID_HEADER)).toBe(REQUEST_ID);
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.get(RCAT_REQUEST_ID_HEADER)).toBe(REQUEST_ID);
  });

  it("logs upstream failures with the same ID while excluding query values and exception messages", async () => {
    const logger = vi.fn();
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("upstream secret detail token=abc123");
    });
    const response = createResponse();

    await handleAdminProxyRequest(createRequest("/api/admin/users?email=user@example.test&token=secret"), response, {
      createRequestId: () => REQUEST_ID,
      env: createEnv(),
      fetchImpl,
      logger
    });

    expect(response.statusCode).toBe(502);
    expect(response.getHeader(RCAT_REQUEST_ID_HEADER)).toBe(REQUEST_ID);
    expect(logger).toHaveBeenCalledTimes(1);
    const logLine = logger.mock.calls[0][0];
    const payload = JSON.parse(logLine);
    expect(payload).toMatchObject({
      event: "admin_proxy_upstream_request_failed",
      component: "admin-proxy",
      requestId: REQUEST_ID,
      method: "GET",
      pathname: "/api/admin/users",
      errorName: "TypeError"
    });
    expect(logLine).not.toContain("abc123");
    expect(logLine).not.toContain("user@example.test");
    expect(logLine).not.toContain("token=secret");
  });
});
