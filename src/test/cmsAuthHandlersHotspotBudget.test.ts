// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const handlersPath = join(repositoryRoot, "server", "cmsAuth", "handlers.mjs");
const CMS_AUTH_HANDLERS_MAX_BYTES = 48_481;

describe("CMS auth handler hotspot budget", () => {
  it("prevents the monolithic handler module from growing beyond the migration baseline", () => {
    const byteLength = readFileSync(handlersPath).byteLength;

    expect(
      byteLength,
      `server/cmsAuth/handlers.mjs is ${byteLength} bytes; keep it at or below ${CMS_AUTH_HANDLERS_MAX_BYTES} bytes by extracting new responsibilities into focused modules`
    ).toBeLessThanOrEqual(CMS_AUTH_HANDLERS_MAX_BYTES);
  });
});
