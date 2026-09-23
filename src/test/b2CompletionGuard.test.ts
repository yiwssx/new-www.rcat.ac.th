import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("B2 runtime incident completion guard", () => {
  it("keeps the production-governed incident feed, retention contract, and regression suite in place", () => {
    const route = read("cloudflare/public-api/src/routes/runtimeIncidents.ts");
    const tests = read("cloudflare/public-api/test/runtimeIncidents.test.ts");

    expect(route).toContain('export const RUNTIME_INCIDENT_PATH = "/api/public/runtime-incident"');
    expect(route).toContain('export const ADMIN_RUNTIME_INCIDENTS_PATH = "/api/admin/runtime-incidents"');
    expect(route).toContain("const MAX_RUNTIME_INCIDENTS = 2_000");
    expect(route).toContain("const MAX_FEED_WINDOW_HOURS = 24 * 7");
    expect(route).toContain('requireAdminCapability(authResult.identity, "dashboard.read"');
    expect(tests).toContain("rejects untrusted browser origins");
    expect(tests).toContain("keeps the incident feed behind the existing CMS server-proxy authentication boundary");
  });
});
