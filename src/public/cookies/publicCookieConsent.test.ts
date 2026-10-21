import { describe, expect, it } from "vitest";
import { parsePublicCookieConsent } from "./publicCookieConsent";

const now = Date.UTC(2026, 9, 21, 0, 0, 0);

function record(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: 1,
    analytics: true,
    decidedAt: new Date(now - 1000).toISOString(),
    ...overrides
  });
}

describe("public cookie consent persistence", () => {
  it("does not authorize analytics without a valid, explicit saved decision", () => {
    expect(parsePublicCookieConsent(null, now)).toBeNull();
    expect(parsePublicCookieConsent("{broken", now)).toBeNull();
    expect(parsePublicCookieConsent(record({ analytics: "true" }), now)).toBeNull();
    expect(parsePublicCookieConsent(record({ version: 99 }), now)).toBeNull();
    expect(parsePublicCookieConsent(record({ decidedAt: "invalid" }), now)).toBeNull();
    expect(parsePublicCookieConsent(record({ decidedAt: new Date(now + 10).toISOString() }), now)).toBeNull();
  });

  it("keeps an explicit rejection and an explicit acceptance distinct", () => {
    expect(parsePublicCookieConsent(record({ analytics: false }), now)?.analytics).toBe(false);
    expect(parsePublicCookieConsent(record(), now)?.analytics).toBe(true);
  });

  it("expires decisions after 180 days", () => {
    const expired = new Date(now - 180 * 24 * 60 * 60 * 1000).toISOString();
    expect(parsePublicCookieConsent(record({ decidedAt: expired }), now)).toBeNull();
  });
});
