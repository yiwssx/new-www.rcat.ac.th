import { describe, expect, it } from "vitest";
import { formatPreflightResult, runPreviewSmokePreflight } from "../scripts/preview-smoke-preflight.mjs";
import scriptSource from "../scripts/preview-smoke-preflight.mjs?raw";

const validFakePreviewEnv = {
  RCAT_PREVIEW_D1_DATABASE_NAME: "rcat-public-api-preview",
  RCAT_PREVIEW_D1_DATABASE_ID: "preview-d1-id-example",
  RCAT_PREVIEW_WORKER_URL: "https://preview-worker.example.test",
  RCAT_VERCEL_PREVIEW_URL: "https://preview-frontend.example.test"
};

describe("M6.3 preview smoke preflight", () => {
  it("returns BLOCKED when required external preview values are missing", () => {
    const result = runPreviewSmokePreflight({});
    const output = formatPreflightResult(result);

    expect(result.status).toBe("BLOCKED");
    expect(result.missingKeys).toEqual([
      "RCAT_PREVIEW_D1_DATABASE_NAME",
      "RCAT_PREVIEW_D1_DATABASE_ID",
      "RCAT_PREVIEW_WORKER_URL",
      "RCAT_VERCEL_PREVIEW_URL"
    ]);
    expect(output).toContain("BLOCKED");
    expect(output).toContain("Missing required environment variables");
  });

  it("returns BLOCKED when the committed preview D1 placeholder is used", () => {
    const result = runPreviewSmokePreflight({
      ...validFakePreviewEnv,
      RCAT_PREVIEW_D1_DATABASE_ID: "preview-placeholder"
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.reasons).toContain("RCAT_PREVIEW_D1_DATABASE_ID must not be preview-placeholder.");
  });

  it("returns BLOCKED for production-like preview resource values", () => {
    const productionDomain = "rcat" + ".ac.th";
    const result = runPreviewSmokePreflight({
      ...validFakePreviewEnv,
      RCAT_PREVIEW_D1_DATABASE_NAME: "rcat-public-api-production",
      RCAT_PREVIEW_WORKER_URL: `https://worker.${productionDomain}`
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.reasons).toContain("RCAT_PREVIEW_D1_DATABASE_NAME must not look like production.");
    expect(result.reasons).toContain("RCAT_PREVIEW_WORKER_URL must not include forbidden production domains.");
  });

  it("returns READY for complete fake non-production preview values", () => {
    const result = runPreviewSmokePreflight(validFakePreviewEnv);
    const output = formatPreflightResult(result);

    expect(result.status).toBe("READY");
    expect(result.missingKeys).toEqual([]);
    expect(result.reasons).toEqual([]);
    expect(output).toContain("READY");
    expect(output).toContain("D1 database id: present (redacted)");
    expect(output).not.toContain(validFakePreviewEnv.RCAT_PREVIEW_D1_DATABASE_ID);
  });

  it("does not include remote execution primitives", () => {
    expect(scriptSource).not.toMatch(/\bchild_process\b/);
    expect(scriptSource).not.toMatch(/\bexec(?:File)?\s*\(/);
    expect(scriptSource).not.toMatch(/\bspawn\s*\(/);
    expect(scriptSource).not.toMatch(/\bfetch\s*\(/);
    expect(scriptSource).not.toMatch(/\bwrangler\s+(?:d1|deploy)\b/i);
    expect(scriptSource).not.toMatch(/\bvercel\s+env\b/i);
  });
});
