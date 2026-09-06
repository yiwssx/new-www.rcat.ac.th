// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getCmsClientMetadata } from "./protocol.mjs";

function request(headers = {}) {
  return {
    headers: Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]))
  };
}

describe("CMS client metadata", () => {
  it("prefers Vercel's documented x-forwarded-for client IP across serverless routes", () => {
    const metadata = getCmsClientMetadata(
      request({
        "x-forwarded-for": "203.0.113.25",
        "x-vercel-forwarded-for": "192.0.2.10, 198.51.100.1",
        "x-real-ip": "198.51.100.40",
        "user-agent": "phase-c3-browser/1.0"
      })
    );

    expect(metadata).toEqual({
      clientIp: "203.0.113.25",
      userAgent: "phase-c3-browser/1.0"
    });
  });

  it("retains bounded legacy fallbacks when x-forwarded-for is unavailable", () => {
    expect(
      getCmsClientMetadata(
        request({
          "x-vercel-forwarded-for": "192.0.2.10, 198.51.100.1",
          "x-real-ip": "198.51.100.40",
          "user-agent": "phase-c3-browser/1.0"
        })
      ).clientIp
    ).toBe("192.0.2.10");

    expect(
      getCmsClientMetadata(
        request({
          "x-real-ip": "198.51.100.40",
          "user-agent": "phase-c3-browser/1.0"
        })
      ).clientIp
    ).toBe("198.51.100.40");
  });

  it("fails metadata closed when the preferred client IP header is malformed", () => {
    const metadata = getCmsClientMetadata(
      request({
        "x-forwarded-for": "not-an-ip",
        "x-vercel-forwarded-for": "192.0.2.10",
        "user-agent": "phase-c3-browser/1.0"
      })
    );

    expect(metadata.clientIp).toBe("unknown");
  });
});
