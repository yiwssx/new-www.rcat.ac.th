// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const handlersPath = join(repositoryRoot, "server", "cmsAuth", "handlers.mjs");
const protocolPath = join(repositoryRoot, "server", "cmsAuth", "protocol.mjs");
const rateLimitersPath = join(repositoryRoot, "server", "cmsAuth", "rateLimiters.mjs");
const CMS_AUTH_HANDLERS_MAX_BYTES = 35_278;
const CMS_AUTH_PROTOCOL_MAX_BYTES = 9_000;
const CMS_AUTH_RATE_LIMITERS_MAX_BYTES = 6_000;

describe("CMS auth module hotspot budgets", () => {
  it("locks the smaller handler baseline after extracting protocol infrastructure", () => {
    const byteLength = readFileSync(handlersPath).byteLength;

    expect(
      byteLength,
      `server/cmsAuth/handlers.mjs is ${byteLength} bytes; keep it at or below ${CMS_AUTH_HANDLERS_MAX_BYTES} bytes by extracting responsibilities into focused modules`
    ).toBeLessThanOrEqual(CMS_AUTH_HANDLERS_MAX_BYTES);
  });

  it("keeps the extracted protocol module focused", () => {
    const byteLength = readFileSync(protocolPath).byteLength;

    expect(
      byteLength,
      `server/cmsAuth/protocol.mjs is ${byteLength} bytes; keep it at or below ${CMS_AUTH_PROTOCOL_MAX_BYTES} bytes instead of creating a replacement auth monolith`
    ).toBeLessThanOrEqual(CMS_AUTH_PROTOCOL_MAX_BYTES);
  });

  it("keeps the extracted rate limiter module focused", () => {
    const byteLength = readFileSync(rateLimitersPath).byteLength;

    expect(
      byteLength,
      `server/cmsAuth/rateLimiters.mjs is ${byteLength} bytes; keep it at or below ${CMS_AUTH_RATE_LIMITERS_MAX_BYTES} bytes instead of creating a new auth monolith`
    ).toBeLessThanOrEqual(CMS_AUTH_RATE_LIMITERS_MAX_BYTES);
  });
});
