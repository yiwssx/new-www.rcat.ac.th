import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { isValidRequestId, RCAT_REQUEST_ID_HEADER, resolveRequestId } from "../src/requestId";

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";
const PROXY_SECRET = "test-only-private-boundary-marker";

describe("Worker request correlation", () => {
  it("generates a request ID for direct public traffic instead of trusting a browser-supplied value", async () => {
    const response = await worker.fetch(
      new Request("https://public-api.example.test/health", {
        headers: {
          [RCAT_REQUEST_ID_HEADER]: REQUEST_ID
        }
      }),
      {}
    );
    const responseRequestId = response.headers.get(RCAT_REQUEST_ID_HEADER);

    expect(response.status).toBe(200);
    expect(isValidRequestId(responseRequestId)).toBe(true);
    expect(responseRequestId).not.toBe(REQUEST_ID);
  });

  it("accepts a valid correlation ID only when the private proxy secret matches", () => {
    const request = new Request("https://public-api.example.test/api/admin/snapshot", {
      headers: {
        [RCAT_REQUEST_ID_HEADER]: REQUEST_ID,
        "X-RCAT-CMS-Auth-Proxy-Secret": PROXY_SECRET
      }
    });

    expect(resolveRequestId(request, { CMS_AUTH_PROXY_SECRET: PROXY_SECRET })).toBe(REQUEST_ID);
  });

  it("does not trust a private-path request ID when the proxy secret is wrong", () => {
    const request = new Request("https://public-api.example.test/api/admin/snapshot", {
      headers: {
        [RCAT_REQUEST_ID_HEADER]: REQUEST_ID,
        "X-RCAT-CMS-Auth-Proxy-Secret": "attacker-supplied-marker"
      }
    });
    const requestId = resolveRequestId(request, { CMS_AUTH_PROXY_SECRET: PROXY_SECRET });

    expect(isValidRequestId(requestId)).toBe(true);
    expect(requestId).not.toBe(REQUEST_ID);
  });

  it("rejects malformed private correlation IDs and generates a new UUID", () => {
    const request = new Request("https://public-api.example.test/api/internal/cms-auth/session", {
      headers: {
        [RCAT_REQUEST_ID_HEADER]: "attacker-controlled-value",
        "X-RCAT-CMS-Auth-Proxy-Secret": PROXY_SECRET
      }
    });
    const requestId = resolveRequestId(request, { CMS_AUTH_PROXY_SECRET: PROXY_SECRET });

    expect(isValidRequestId(requestId)).toBe(true);
    expect(requestId).not.toBe("attacker-controlled-value");
  });
});
