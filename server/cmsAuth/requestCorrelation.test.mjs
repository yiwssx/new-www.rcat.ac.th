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
  it("creates one server-owned ID and forwards it through the correlated handler fetch", async () => {
    const request = createRequest();
    const response = createResponse();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const session = vi.fn(async (selectedRequest, _selectedResponse, handlerOptions) => {
      expect(selectedRequest.url).toBe("/api/cms-auth/session");
      expect(getNodeRequestId(selectedRequest)).toBe(REQUEST_ID);
      expect(typeof handlerOptions.fetchImpl).toBe("function");

      await handlerOptions.fetchImpl("https://worker.example.test/api/internal/cms-auth/session", {
        method: "GET",
        headers: {
          "X-RCAT-CMS-Auth-Proxy-Secret": "test-secret"
        }
      });
    });

    await handleCmsAuthDispatch(request, response, {
      createRequestId: () => REQUEST_ID,
      fetchImpl,
      handlers: { session }
    });

    expect(session).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, upstreamInit] = fetchImpl.mock.calls[0];
    expect(upstreamInit.headers.get("X-RCAT-CMS-Auth-Proxy-Secret")).toBe("test-secret");
    expect(upstreamInit.headers.get(RCAT_REQUEST_ID_HEADER)).toBe(REQUEST_ID);
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
