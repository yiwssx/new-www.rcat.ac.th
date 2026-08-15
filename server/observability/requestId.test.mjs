// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  ensureNodeRequestId,
  getNodeRequestId,
  getSafeRequestPathname,
  isValidRequestId,
  logOperationalError,
  RCAT_REQUEST_ID_HEADER
} from "./requestId.mjs";

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";

function createResponse() {
  const headers = new Map();
  return {
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    }
  };
}

describe("server request correlation", () => {
  it("creates one server-owned request ID and reuses it for the request lifetime", () => {
    const request = { headers: { "x-rcat-request-id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } };
    const response = createResponse();
    const createId = vi.fn(() => REQUEST_ID);

    expect(ensureNodeRequestId(request, response, { createId })).toBe(REQUEST_ID);
    expect(ensureNodeRequestId(request, response, { createId })).toBe(REQUEST_ID);
    expect(getNodeRequestId(request)).toBe(REQUEST_ID);
    expect(response.getHeader(RCAT_REQUEST_ID_HEADER)).toBe(REQUEST_ID);
    expect(createId).toHaveBeenCalledTimes(1);
  });

  it("validates UUID-shaped request IDs", () => {
    expect(isValidRequestId(REQUEST_ID)).toBe(true);
    expect(isValidRequestId("not-a-request-id")).toBe(false);
  });

  it("logs only safe operational metadata without query strings or error messages", () => {
    const logger = vi.fn();
    const error = new TypeError("secret upstream detail token=abc123");

    logOperationalError({
      component: "admin-proxy",
      error,
      event: "upstream_failed",
      logger,
      method: "post",
      pathname: "/api/admin/users?token=secret&email=user@example.test",
      requestId: REQUEST_ID,
      status: 502
    });

    expect(logger).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(logger.mock.calls[0][0]);
    expect(payload).toEqual({
      level: "error",
      event: "upstream_failed",
      component: "admin-proxy",
      requestId: REQUEST_ID,
      method: "POST",
      pathname: "/api/admin/users",
      status: 502,
      errorName: "TypeError"
    });
    expect(logger.mock.calls[0][0]).not.toContain("abc123");
    expect(logger.mock.calls[0][0]).not.toContain("user@example.test");
  });

  it("normalizes invalid request URLs to a finite placeholder", () => {
    expect(getSafeRequestPathname("http://[")).toBe("/invalid-request-url");
  });
});
