// @vitest-environment node
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { handleCmsAuthDispatch } from "./dispatcher.mjs";

function createRequest({ url, query }) {
  const request = new Readable({
    read() {
      this.push(null);
    }
  });
  request.url = url;
  request.method = "GET";
  request.headers = {};
  if (query !== undefined) request.query = query;
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
    }
  };
}

function sessionHandlers(handler = vi.fn()) {
  return { session: handler };
}

async function expectSessionDispatch(request) {
  const response = createResponse();
  const handler = vi.fn(async (selectedRequest) => {
    expect(selectedRequest.url).toBe("/api/cms-auth/session");
  });

  await handleCmsAuthDispatch(request, response, { handlers: sessionHandlers(handler) });

  expect(handler).toHaveBeenCalledTimes(1);
  return response;
}

async function expectRejected(request) {
  const response = createResponse();
  const handler = vi.fn();

  await handleCmsAuthDispatch(request, response, { handlers: sessionHandlers(handler) });

  expect(handler).not.toHaveBeenCalled();
  expect(response.statusCode).toBe(404);
  expect(response.getHeader("Cache-Control")).toBe("no-store");
  expect(response.bodyText).toBe('{"error":"not found"}');
}

describe("CMS-auth Vercel deployment-share metadata", () => {
  it("ignores _vercel_share beside the exact internal URL route marker", async () => {
    await expectSessionDispatch(
      createRequest({ url: "/api/cms-auth?_rcatCmsRoute=session&_vercel_share=opaque-share-token" })
    );
  });

  it("ignores _vercel_share beside the exact public URL route marker", async () => {
    await expectSessionDispatch(
      createRequest({ url: "/api/cms-auth/session?_rcatCmsRoute=session&_vercel_share=opaque-share-token" })
    );
  });

  it("ignores _vercel_share on an exact finite public path", async () => {
    await expectSessionDispatch(createRequest({ url: "/api/cms-auth/session?_vercel_share=opaque-share-token" }));
  });

  it("ignores _vercel_share in request.query beside the matching route marker", async () => {
    await expectSessionDispatch(
      createRequest({
        url: "/api/cms-auth/session",
        query: { _rcatCmsRoute: "session", _vercel_share: "opaque-share-token" }
      })
    );
  });

  it("does not let _vercel_share select a route on the internal dispatcher by itself", async () => {
    await expectRejected(
      createRequest({
        url: "/api/cms-auth",
        query: { _vercel_share: "opaque-share-token" }
      })
    );
  });

  it("still rejects additional application URL query parameters", async () => {
    await expectRejected(
      createRequest({
        url: "/api/cms-auth/session?_rcatCmsRoute=session&_vercel_share=opaque-share-token&token=unexpected"
      })
    );
  });

  it("still rejects additional application request.query parameters", async () => {
    await expectRejected(
      createRequest({
        url: "/api/cms-auth/session",
        query: { _rcatCmsRoute: "session", _vercel_share: "opaque-share-token", token: "unexpected" }
      })
    );
  });

  it("still rejects a route marker that does not match the public path", async () => {
    await expectRejected(
      createRequest({ url: "/api/cms-auth/session?_rcatCmsRoute=login&_vercel_share=opaque-share-token" })
    );
  });

  it("still rejects encoded route-marker values", async () => {
    await expectRejected(
      createRequest({ url: "/api/cms-auth/session?_rcatCmsRoute=sess%69on&_vercel_share=opaque-share-token" })
    );
  });
});
