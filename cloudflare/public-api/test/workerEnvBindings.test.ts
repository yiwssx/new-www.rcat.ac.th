import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wranglerConfig = readFileSync(resolve(process.cwd(), "cloudflare/public-api/wrangler.toml"), "utf8");
const workerEnvContract = readFileSync(resolve(process.cwd(), "cloudflare/public-api/src/env.ts"), "utf8");

function uniqueBindingNames(pattern: RegExp) {
  return [...new Set([...wranglerConfig.matchAll(pattern)].map((match) => match[1]))].sort();
}

function declaredBindingNames(bindingType: "D1Database" | "RateLimit") {
  const matcher = new RegExp(`^\\s*([A-Z][A-Z_]+)\\?: ${bindingType};$`, "gm");
  return [...workerEnvContract.matchAll(matcher)].map((match) => match[1]).sort();
}

describe("Worker Wrangler-to-Env platform binding contract", () => {
  it("keeps D1 binding names synchronized across local and production config", () => {
    expect(uniqueBindingNames(/^binding = "([A-Z][A-Z_]+)"$/gm)).toEqual(["DB"]);
    expect(declaredBindingNames("D1Database")).toEqual(["DB"]);
  });

  it("keeps rate-limit binding names synchronized across local and production config", () => {
    const expected = [
      "ADMIN_API_RATE_LIMITER",
      "CMS_AUTH_RATE_LIMITER",
      "PUBLIC_CONTENT_VIEW_RATE_LIMITER",
      "PUBLIC_PRESENCE_RATE_LIMITER",
      "PUBLIC_SITE_VIEW_RATE_LIMITER",
      "RUNTIME_INCIDENT_RATE_LIMITER"
    ];
    expect(uniqueBindingNames(/^name = "([A-Z][A-Z_]+)"$/gm)).toEqual(expected);
    expect(declaredBindingNames("RateLimit")).toEqual(expected);
  });

  it("preserves optional bindings for local tests and missing-binding fail-closed paths", () => {
    expect(workerEnvContract).toMatch(/DB\?: D1Database;/);
    expect(workerEnvContract).toMatch(/CMS_AUTH_PROXY_SECRET\?: string;/);
    expect(workerEnvContract).toMatch(/CMS_MFA_ENCRYPTION_KEY\?: string;/);
  });
});
