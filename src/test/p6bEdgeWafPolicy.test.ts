import { describe, expect, it } from "vitest";
import { evaluateP6bEdgeWaf } from "../../server/security/edgeWafPolicy";

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://www.rcat.ac.th${path}`, init);
}

describe("P6B Vercel edge WAF policy", () => {
  it("denies direct access to internal API namespaces", () => {
    expect(evaluateP6bEdgeWaf(request("/api/internal/cms-auth/login"))).toEqual({
      action: "deny",
      status: 403,
      reason: "internal-namespace"
    });
  });

  it("denies cross-site requests to CMS auth", () => {
    expect(
      evaluateP6bEdgeWaf(
        request("/api/cms-auth/login", {
          method: "POST",
          headers: { Origin: "https://attacker.example", "Sec-Fetch-Site": "cross-site" }
        })
      )
    ).toEqual({ action: "deny", status: 403, reason: "cross-site" });
  });

  it("allows same-origin CMS auth requests", () => {
    expect(
      evaluateP6bEdgeWaf(
        request("/api/cms-auth/login", {
          method: "POST",
          headers: { Origin: "https://www.rcat.ac.th", "Sec-Fetch-Site": "same-origin" }
        })
      )
    ).toEqual({ action: "allow" });
  });

  it("rejects oversized CMS auth bodies before the function runtime", () => {
    expect(
      evaluateP6bEdgeWaf(
        request("/api/cms-auth/login", {
          method: "POST",
          headers: { "Content-Length": String(16 * 1024 + 1) }
        })
      )
    ).toEqual({ action: "deny", status: 413, reason: "body-size" });
  });

  it("allows unrelated public API requests", () => {
    expect(evaluateP6bEdgeWaf(request("/api/public/home"))).toEqual({ action: "allow" });
  });
});
