// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const handlersPath = join(repositoryRoot, "server", "cmsAuth", "handlers.mjs");
const rateLimitersPath = join(repositoryRoot, "server", "cmsAuth", "rateLimiters.mjs");
const CMS_AUTH_HANDLERS_MAX_BYTES = 43_025;
const CMS_AUTH_RATE_LIMITERS_MAX_BYTES = 6_000;

describe("CMS auth module hotspot budgets", () => {
  it("locks the smaller handler baseline after extracting rate limiting", () => {
    const byteLength = readFileSync(handlersPath).byteLength;

    expect(
      byteLength,
      `server/cmsAuth/handlers.mjs is ${byteLength} bytes; keep it at or below ${CMS_AUTH_HANDLERS_MAX_BYTES} bytes by extracting responsibilities into focused modules`
    ).toBeLessThanOrEqual(CMS_AUTH_HANDLERS_MAX_BYTES);
  });

  it("keeps the extracted rate limiter module focused", () => {
    const byteLength = readFileSync(rateLimitersPath).byteLength;

    expect(
      byteLength,
      `server/cmsAuth/rateLimiters.mjs is ${byteLength} bytes; keep it at or below ${CMS_AUTH_RATE_LIMITERS_MAX_BYTES} bytes instead of creating a new auth monolith`
    ).toBeLessThanOrEqual(CMS_AUTH_RATE_LIMITERS_MAX_BYTES);
  });
});
