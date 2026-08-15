// @vitest-environment node

import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { getNodeRequestId, RCAT_REQUEST_ID_HEADER } from "../observability/requestId.mjs";
import { handleCmsAuthDispatch } from "./dispatcher.mjs";

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";

function createRequest() {
  const request = Readable.from([]);
  request.method = "GET";
  request.url = "/api/cms-auth?_rcatCmsRoute=session";
  request.headers = { host: "cms.example.test" };
  return request;
}

function createResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    end() {}
  };
}

describe("CMS auth request correlation", () => {
  it("creates one server-owned ID before dispatch and preserves it on the canonical request adapter", async () => {
    const request = createRequest();
    const response = createResponse();
    const session = vi.fn(async (selectedRequest) => {
      expect(selectedRequest.url).toBe("/api/cms-auth/session");
      expect(getNodeRequestId(selectedRequest)).toBe(REQUEST_ID);
    });

    await handleCmsAuthDispatch(request, response, {
      createRequestId: () => REQUEST_ID,
      handlers: { session }
    });

    expect(session).toHaveBeenCalledTimes(1);
    expect(getNodeRequestId(request)).toBe(REQUEST_ID);
    expect(response.getHeader(RCAT_REQUEST_ID_HEADER)).toBe(REQUEST_ID);
  });

  it("attaches the request ID even to rejected dispatcher routes for support correlation", async () => {
    const request = createRequest();
    request.url = "/api/cms-auth?_rcatCmsRoute=unknown";
    const response = createResponse();

    await handleCmsAuthDispatch(request, response, {
      createRequestId: () => REQUEST_ID,
      handlers: {}
    });

    expect(response.statusCode).toBe(404);
    expect(response.getHeader(RCAT_REQUEST_ID_HEADER)).toBe(REQUEST_ID);
  });
});
