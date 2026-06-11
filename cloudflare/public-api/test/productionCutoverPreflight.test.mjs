import { describe, expect, it } from "vitest";
import m8PreflightDoc from "../../../docs/architecture/m8-production-cutover-preflight-2026-06-11.md?raw";
import rootPackageJsonSource from "../../../package.json?raw";
import workerPackageJsonSource from "../package.json?raw";
import {
  formatProductionPreflightResult,
  runProductionCutoverPreflight
} from "../scripts/production-cutover-preflight.mjs";
import scriptSource from "../scripts/production-cutover-preflight.mjs?raw";

const validFakeProductionEnv = {
  RCAT_PROD_D1_DATABASE_NAME: "rcat-public-api-production",
  RCAT_PROD_D1_DATABASE_ID: "12345678-1234-1234-1234-123456789abc",
  RCAT_PROD_WORKER_URL: "https://public-api.example-production.invalid",
  RCAT_PROD_FRONTEND_URL: "https://www.example-production.invalid",
  RCAT_PROD_CUTOVER_APPROVAL: "APPROVED_MANUAL_CUTOVER"
};

const committedD1DatabaseIdPattern = /^\s*database_id\s*=\s*"[0-9a-f-]{32,}"\s*$/im;
const forbiddenUrlPattern = /https?:\/\/[^\s)"']*(?:script\.google\.com|drive\.google\.com)/i;

describe("M8 production cutover preflight documentation", () => {
  it("documents a local-only production cutover preflight without approving cutover", () => {
    expect(m8PreflightDoc).toMatch(
      /Status: production cutover preflight only\. Production cutover is not executed or approved by this checkpoint\./i
    );
    expect(m8PreflightDoc).toMatch(/public-document-list/i);
    expect(m8PreflightDoc).toContain("RCAT_PROD_D1_DATABASE_NAME");
    expect(m8PreflightDoc).toContain("RCAT_PROD_D1_DATABASE_ID");
    expect(m8PreflightDoc).toContain("RCAT_PROD_WORKER_URL");
    expect(m8PreflightDoc).toContain("RCAT_PROD_FRONTEND_URL");
    expect(m8PreflightDoc).toContain("RCAT_PROD_CUTOVER_APPROVAL");
    expect(m8PreflightDoc).toContain("APPROVED_MANUAL_CUTOVER");
    expect(m8PreflightDoc).toMatch(/BLOCKED/i);
    expect(m8PreflightDoc).toMatch(/READY/i);
    expect(m8PreflightDoc).toMatch(/Production Cutover Evidence Template/i);
    expect(m8PreflightDoc).toMatch(/No-Go Conditions/i);
    expect(m8PreflightDoc).not.toMatch(committedD1DatabaseIdPattern);
    expect(m8PreflightDoc).not.toMatch(forbiddenUrlPattern);
    expect(m8PreflightDoc).not.toMatch(/production cutover\s*(?:completed|passed|enabled|active|approved)/i);
  });
});

describe("M8 production cutover preflight script", () => {
  it("is exposed through the root package scripts", () => {
    const rootPackageJson = JSON.parse(rootPackageJsonSource);
    const workerPackageJson = JSON.parse(workerPackageJsonSource);

    expect(rootPackageJson.scripts["worker:production:preflight"]).toBe(
      "node cloudflare/public-api/scripts/production-cutover-preflight.mjs"
    );
    expect(workerPackageJson.scripts["worker:production:preflight"]).toBe(
      "node scripts/production-cutover-preflight.mjs"
    );
  });

  it("prints BLOCKED and exits logically clean when required env is missing", () => {
    const result = runProductionCutoverPreflight({});
    const output = formatProductionPreflightResult(result);

    expect(result.status).toBe("BLOCKED");
    expect(result.missingKeys).toEqual([
      "RCAT_PROD_D1_DATABASE_NAME",
      "RCAT_PROD_D1_DATABASE_ID",
      "RCAT_PROD_WORKER_URL",
      "RCAT_PROD_FRONTEND_URL",
      "RCAT_PROD_CUTOVER_APPROVAL"
    ]);
    expect(output).toContain("BLOCKED");
    expect(output).toContain("No production commands were run.");
  });

  it("rejects placeholder D1 ids and unsafe production-like inputs", () => {
    const placeholderResult = runProductionCutoverPreflight({
      ...validFakeProductionEnv,
      RCAT_PROD_D1_DATABASE_ID: "preview-placeholder"
    });
    const previewNameResult = runProductionCutoverPreflight({
      ...validFakeProductionEnv,
      RCAT_PROD_D1_DATABASE_NAME: "rcat-public-api-preview"
    });
    const nonHttpsResult = runProductionCutoverPreflight({
      ...validFakeProductionEnv,
      RCAT_PROD_WORKER_URL: "http://public-api.example-production.invalid"
    });
    const approvalResult = runProductionCutoverPreflight({
      ...validFakeProductionEnv,
      RCAT_PROD_CUTOVER_APPROVAL: "APPROVED"
    });

    expect(placeholderResult.status).toBe("BLOCKED");
    expect(placeholderResult.reasons).toContain("RCAT_PROD_D1_DATABASE_ID must not be preview-placeholder.");
    expect(previewNameResult.status).toBe("BLOCKED");
    expect(previewNameResult.reasons).toContain("RCAT_PROD_D1_DATABASE_NAME must not look like preview/local/test.");
    expect(nonHttpsResult.status).toBe("BLOCKED");
    expect(nonHttpsResult.reasons).toContain("RCAT_PROD_WORKER_URL must use HTTPS.");
    expect(approvalResult.status).toBe("BLOCKED");
    expect(approvalResult.reasons).toContain(
      "RCAT_PROD_CUTOVER_APPROVAL must equal APPROVED_MANUAL_CUTOVER; M8 does not execute cutover."
    );
  });

  it("prints READY for safe fake production-like env while redacting identifiers", () => {
    const result = runProductionCutoverPreflight(validFakeProductionEnv);
    const output = formatProductionPreflightResult(result);

    expect(result.status).toBe("READY");
    expect(result.safeSummary.d1DatabaseIdRedacted).toBe("1234...9abc");
    expect(output).toContain("READY");
    expect(output).toContain("D1 database id: 1234...9abc");
    expect(output).toContain("Worker origin: https://public-api.example-production.invalid");
    expect(output).toContain("Frontend origin: https://www.example-production.invalid");
    expect(output).toContain("Approval: present");
    expect(output).toContain("No production commands were run.");
    expect(output).not.toContain(validFakeProductionEnv.RCAT_PROD_D1_DATABASE_ID);
  });

  it("contains no remote execution primitives", () => {
    expect(scriptSource).not.toMatch(/\bwrangler\b/i);
    expect(scriptSource).not.toMatch(/\bvercel\b/i);
    expect(scriptSource).not.toMatch(/\bfetch\s*\(/);
    expect(scriptSource).not.toMatch(/\bexec(?:File|Sync)?\s*\(/);
    expect(scriptSource).not.toMatch(/\bspawn(?:Sync)?\s*\(/);
    expect(scriptSource).not.toMatch(/\bcurl\b/i);
    expect(scriptSource).not.toMatch(/\bchild_process\b/);
  });
});
