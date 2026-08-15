// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { ensureNodeRequestId, RCAT_REQUEST_ID_HEADER } from "../observability/requestId.mjs";
import { createCmsCorrelatedFetch } from "./upstreamFetch.mjs";

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";

function createRequestWithId() {
  const request = {};
  ensureNodeRequestId(request, null, { createId: () => REQUEST_ID });
  return request;
}

describe("CMS correlated upstream fetch", () => {
  it("adds the server-owned request ID while preserving private upstream headers", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const correlatedFetch = createCmsCorrelatedFetch(createRequestWithId(), fetchImpl);

    await correlatedFetch("https://worker.example.test/api/internal/cms-auth/session", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-RCAT-CMS-Auth-Proxy-Secret": "test-secret",
        "X-RCAT-CMS-Session-Token": "test-session"
      },
      redirect: "error"
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://worker.example.test/api/internal/cms-auth/session");
    expect(init.method).toBe("GET");
    expect(init.redirect).toBe("error");
    expect(init.headers.get("Accept")).toBe("application/json");
    expect(init.headers.get("X-RCAT-CMS-Auth-Proxy-Secret")).toBe("test-secret");
    expect(init.headers.get("X-RCAT-CMS-Session-Token")).toBe("test-session");
    expect(init.headers.get(RCAT_REQUEST_ID_HEADER)).toBe(REQUEST_ID);
  });

  it("does not invent a correlation header when no server-owned request ID exists", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const correlatedFetch = createCmsCorrelatedFetch({}, fetchImpl);

    await correlatedFetch("https://worker.example.test/api/internal/cms-auth/session", {
      headers: { Accept: "application/json" }
    });

    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.get(RCAT_REQUEST_ID_HEADER)).toBeNull();
  });
});
