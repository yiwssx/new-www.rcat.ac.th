import { describe, expect, it, vi } from "vitest";
import m15Doc from "../../../docs/architecture/m15-public-document-list-production-frontend-cutover-rollback-2026-06-11.md?raw";
import rootPackageJsonSource from "../../../package.json?raw";
import publicApiProviderSource from "../../../src/config/publicApiProvider.ts?raw";
import {
  formatPublicDocumentsProductionCutoverResult,
  getProductionCutoverExitCode,
  runPublicDocumentsProductionCutover
} from "../scripts/public-documents-production-cutover.mjs";
import cutoverSource from "../scripts/public-documents-production-cutover.mjs?raw";
import workerPackageJsonSource from "../package.json?raw";
import wranglerToml from "../wrangler.toml?raw";

type CutoverRuntimeOptions = NonNullable<Parameters<typeof runPublicDocumentsProductionCutover>[1]>;
type CutoverFetch = NonNullable<CutoverRuntimeOptions["fetch"]>;
type CutoverExecuteCommand = NonNullable<CutoverRuntimeOptions["executeCommand"]>;

const safeFrontendOrigin = "https://www-production.example.invalid";
const safeWorkerOrigin = "https://public-api-production.example.invalid";
const fixedGeneratedAt = "2026-06-11T00:00:00.000Z";
const cutoverApproval = "APPROVED_PUBLIC_DOCUMENT_FRONTEND_CUTOVER";
const rollbackApproval = "APPROVED_PUBLIC_DOCUMENT_FRONTEND_ROLLBACK";
const forbiddenProductionPattern = new RegExp(
  [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`]
    .map((value) => value.replaceAll(".", "\\."))
    .join("|"),
  "i"
);
const realD1IdPattern = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;
const secretPattern = /VERCEL_TOKEN_VALUE|vercel-project-secret|vercel-org-secret/i;
const validEnv = {
  RCAT_PROD_FRONTEND_URL: safeFrontendOrigin,
  RCAT_PROD_WORKER_URL: safeWorkerOrigin,
  RCAT_M15_CUTOVER_APPROVAL: cutoverApproval,
  RCAT_M15_ROLLBACK_APPROVAL: rollbackApproval,
  RCAT_M15_OPERATOR: "redacted-operator",
  VERCEL_TOKEN: "VERCEL_TOKEN_VALUE",
  VERCEL_PROJECT_ID: "vercel-project-secret",
  VERCEL_ORG_ID: "vercel-org-secret"
};
const validItems: Array<Record<string, unknown>> = [
  {
    id: "redacted-prod-doc-001",
    title: "Redacted document one",
    description: "Sensitive description should never print.",
    category: "policy",
    fileUrl: "https://files.example.test/prod-documents/redacted-one.pdf",
    fileName: "redacted-one.pdf",
    mediaId: "redacted-media-one",
    publishedAt: "2026-06-11T08:00:00.000Z",
    order: 1,
    pinned: true,
    updatedAt: "2026-06-11T09:00:00.000Z"
  },
  {
    id: "redacted-prod-doc-002",
    title: "Redacted document two",
    description: "Another sensitive description should never print.",
    category: "policy",
    fileUrl: "https://files.example.test/prod-documents/redacted-two.pdf",
    fileName: "redacted-two.pdf",
    mediaId: "redacted-media-two",
    publishedAt: "2026-06-10T08:00:00.000Z",
    order: 2,
    pinned: false,
    updatedAt: "2026-06-10T09:00:00.000Z"
  },
  {
    id: "redacted-prod-doc-003",
    title: "Redacted document three",
    description: "Third sensitive description should never print.",
    category: "policy",
    fileUrl: "https://files.example.test/prod-documents/redacted-three.pdf",
    fileName: "redacted-three.pdf",
    mediaId: "redacted-media-three",
    publishedAt: "2026-06-09T08:00:00.000Z",
    order: 3,
    pinned: false,
    updatedAt: "2026-06-09T09:00:00.000Z"
  },
  {
    id: "redacted-prod-doc-004",
    title: "Redacted document four",
    description: "Fourth sensitive description should never print.",
    category: "policy",
    fileUrl: "https://files.example.test/prod-documents/redacted-four.pdf",
    fileName: "redacted-four.pdf",
    mediaId: "redacted-media-four",
    publishedAt: "2026-06-08T08:00:00.000Z",
    order: 4,
    pinned: false,
    updatedAt: "2026-06-08T09:00:00.000Z"
  }
];

function makeSnapshot(items = validItems, generatedAt = "2026-06-11T10:00:00.000Z") {
  return { items, generatedAt };
}

function makeJsonResponse(body: unknown, init: { ok?: boolean; status?: number; jsonThrows?: boolean } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: {
      get(name: string) {
        return name.toLowerCase() === "content-type" ? "application/json" : null;
      }
    },
    async json() {
      if (init.jsonThrows) {
        throw new Error("invalid json");
      }

      return body;
    },
    async text() {
      return JSON.stringify(body);
    }
  };
}

function makeHtmlResponse(html: string, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: {
      get(name: string) {
        return name.toLowerCase() === "content-type" ? "text/html; charset=utf-8" : null;
      }
    },
    async json() {
      throw new Error("not json");
    },
    async text() {
      return html;
    }
  };
}

function makeFetch(snapshot = makeSnapshot()) {
  return vi.fn<CutoverFetch>(async (input) => {
    if (input === `${safeWorkerOrigin}/api/public/documents`) {
      return makeJsonResponse(snapshot);
    }

    if (input === `${safeFrontendOrigin}/api/public/documents`) {
      return makeJsonResponse(snapshot);
    }

    return makeHtmlResponse('<main data-public-document-list="ready">Public documents</main>');
  });
}

function runCutover(
  args: string[] = [],
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: CutoverFetch;
    executeCommand?: CutoverExecuteCommand;
  } = {}
) {
  return runPublicDocumentsProductionCutover(["--generated-at", fixedGeneratedAt, ...args], {
    env: options.env ?? validEnv,
    fetch: options.fetchImpl ?? makeFetch(),
    executeCommand: options.executeCommand ?? vi.fn<CutoverExecuteCommand>(async () => ({ code: 0 }))
  });
}

function expectSafeOutput(output: string) {
  expect(output).not.toContain(safeFrontendOrigin);
  expect(output).not.toContain(safeWorkerOrigin);
  expect(output).not.toMatch(/https:\/\/files\.example\.test/);
  expect(output).not.toContain("Sensitive description should never print.");
  expect(output).not.toContain("Another sensitive description should never print.");
  expect(output).not.toContain("Redacted document one");
  expect(output).not.toContain("redacted-one.pdf");
  expect(output).not.toContain("<main");
  expect(output).not.toMatch(secretPattern);
  expect(output).not.toMatch(forbiddenProductionPattern);
  expect(output).not.toMatch(realD1IdPattern);
}

describe("M15 production frontend cutover gate", () => {
  it("script exists and is exposed through root and worker package scripts", () => {
    const rootPackageJson = JSON.parse(rootPackageJsonSource);
    const workerPackageJson = JSON.parse(workerPackageJsonSource);

    expect(cutoverSource).toContain("runPublicDocumentsProductionCutover");
    expect(cutoverSource).toContain("getProductionCutoverExitCode");
    expect(rootPackageJson.scripts["worker:public-documents:cutover"]).toBe(
      "node cloudflare/public-api/scripts/public-documents-production-cutover.mjs"
    );
    expect(workerPackageJson.scripts["public-documents:cutover"]).toBe(
      "node scripts/public-documents-production-cutover.mjs"
    );
  });

  it("returns a safe default plan without executing commands or fetching production", async () => {
    const fetchImpl = vi.fn<CutoverFetch>();
    const executeCommand = vi.fn<CutoverExecuteCommand>();
    const result = await runCutover([], { env: {}, fetchImpl, executeCommand });

    expect(result.status).toBe("BLOCKED");
    expect(result.manifest.mode).toBe("plan");
    expect(result.manifest.checks.vercelMutation).toBe("blocked");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("returns dry-run cutover and rollback plans without command execution", async () => {
    const executeCommand = vi.fn<CutoverExecuteCommand>();
    const cutover = await runCutover(["--cutover"], { executeCommand });
    const rollback = await runCutover(["--rollback"], { executeCommand });

    expect(cutover.status).toBe("CUTOVER_READY");
    expect(cutover.manifest.target.providerTarget).toBe("cloudflare");
    expect(cutover.manifest.checks.rollbackReady).toBe("passed");
    expect(rollback.status).toBe("ROLLBACK_READY");
    expect(rollback.manifest.target.providerTarget).toBe("apps-script");
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("verify mode performs only injected frontend fetch verification", async () => {
    const fetchImpl = makeFetch();
    const executeCommand = vi.fn<CutoverExecuteCommand>();
    const result = await runCutover(["--verify", "--expected-min-count", "2"], { fetchImpl, executeCommand });

    expect(result.status).toBe("VERIFIED");
    expect(result.manifest.checks.frontendSmoke).toBe("passed");
    expect(result.manifest.verification.itemCount).toBe(4);
    expect(fetchImpl).toHaveBeenCalledWith(`${safeFrontendOrigin}/api/public/documents`, expect.any(Object));
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("approval gates block execute cutover and rollback before command execution", async () => {
    const executeCommand = vi.fn<CutoverExecuteCommand>();
    const noCutoverApproval = await runCutover(["--cutover", "--execute"], {
      env: { ...validEnv, RCAT_M15_CUTOVER_APPROVAL: "" },
      executeCommand
    });
    const wrongCutoverApproval = await runCutover(["--cutover", "--execute"], {
      env: { ...validEnv, RCAT_M15_CUTOVER_APPROVAL: "approved" },
      executeCommand
    });
    const noRollbackApproval = await runCutover(["--rollback", "--execute"], {
      env: { ...validEnv, RCAT_M15_ROLLBACK_APPROVAL: "" },
      executeCommand
    });
    const wrongRollbackApproval = await runCutover(["--rollback", "--execute"], {
      env: { ...validEnv, RCAT_M15_ROLLBACK_APPROVAL: "approved" },
      executeCommand
    });

    expect(noCutoverApproval.status).toBe("BLOCKED");
    expect(wrongCutoverApproval.status).toBe("BLOCKED");
    expect(noRollbackApproval.status).toBe("BLOCKED");
    expect(wrongRollbackApproval.status).toBe("BLOCKED");
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("blocks missing execution env and unsafe URLs before command execution", async () => {
    const unsafeUrls = [
      "http://production.example.invalid",
      "https://localhost",
      "https://127.0.0.1",
      "https://[::1]",
      "https://site.localhost",
      "https://public-api-preview.example.invalid",
      "https://public-api-staging.example.invalid",
      "https://public-api-dev.example.invalid",
      "https://public-api-test.example.invalid",
      "https://public-api-sandbox.example.invalid",
      `https://${"script"}.${"google"}.com/macros/s/redacted/exec`,
      `https://${"drive"}.${"google"}.com/file/redacted`,
      `https://project-git-preview-redacted.${"ver"}${"cel"}.app`
    ];

    for (const unsafeUrl of unsafeUrls) {
      const executeCommand = vi.fn<CutoverExecuteCommand>();
      const result = await runCutover(["--cutover", "--execute"], {
        env: { ...validEnv, RCAT_PROD_FRONTEND_URL: unsafeUrl },
        executeCommand
      });

      expect(result.status, unsafeUrl).toBe("BLOCKED");
      expect(result.manifest.checks.envGate, unsafeUrl).toBe("blocked");
      expect(executeCommand, unsafeUrl).not.toHaveBeenCalled();
    }

    const executeCommand = vi.fn<CutoverExecuteCommand>();
    const missingVercel = await runCutover(["--cutover", "--execute"], {
      env: { RCAT_PROD_FRONTEND_URL: safeFrontendOrigin, RCAT_PROD_WORKER_URL: safeWorkerOrigin },
      executeCommand
    });

    expect(missingVercel.status).toBe("BLOCKED");
    expect(missingVercel.manifest.checks.envGate).toBe("blocked");
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("requires Worker smoke before execute cutover and uses injected fetch only", async () => {
    const executeCommand = vi.fn<CutoverExecuteCommand>();
    const failedSmokeFetch = vi.fn(async (input: string) => {
      if (input === `${safeWorkerOrigin}/api/public/documents`) {
        return makeJsonResponse({}, { ok: false, status: 503 });
      }

      return makeJsonResponse(makeSnapshot());
    });
    const result = await runCutover(["--cutover", "--execute"], { fetchImpl: failedSmokeFetch, executeCommand });

    expect(result.status).toBe("BLOCKED");
    expect(result.manifest.checks.workerSmoke).toBe("blocked");
    expect(failedSmokeFetch).toHaveBeenCalledWith(`${safeWorkerOrigin}/api/public/documents`, expect.any(Object));
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("execute cutover mutates provider env only after gates pass and verifies frontend", async () => {
    const executeCommand = vi.fn(async () => ({ code: 0 }));
    const result = await runCutover(["--cutover", "--execute", "--expected-min-count", "2"], { executeCommand });
    const output = formatPublicDocumentsProductionCutoverResult(result);

    expect(result.status).toBe("CUTOVER_APPLIED");
    expect(result.manifest.target.providerTarget).toBe("cloudflare");
    expect(result.manifest.checks.workerSmoke).toBe("passed");
    expect(result.manifest.checks.frontendSmoke).toBe("passed");
    expect(result.manifest.checks.vercelMutation).toBe("passed");
    expect(result.manifest.verification.firstPublicItemIds).toEqual([
      "redacted-prod-doc-001",
      "redacted-prod-doc-002",
      "redacted-prod-doc-003"
    ]);
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "vercel",
        args: expect.arrayContaining(["env", "add", "VITE_PUBLIC_API_PROVIDER", "production", "--value", "cloudflare"])
      })
    );
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "vercel",
        args: expect.arrayContaining([
          "env",
          "add",
          "VITE_CLOUDFLARE_PUBLIC_API_URL",
          "production",
          "--value",
          safeWorkerOrigin
        ])
      })
    );
    expectSafeOutput(output);
  });

  it("execute rollback sets provider back to Apps Script and verifies rollback path", async () => {
    const executeCommand = vi.fn(async () => ({ code: 0 }));
    const result = await runCutover(["--rollback", "--execute"], { executeCommand });
    const output = formatPublicDocumentsProductionCutoverResult(result);

    expect(result.status).toBe("ROLLBACK_APPLIED");
    expect(result.manifest.target.providerTarget).toBe("apps-script");
    expect(result.manifest.checks.frontendSmoke).toBe("passed");
    expect(result.manifest.checks.rollbackReady).toBe("passed");
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "vercel",
        args: expect.arrayContaining(["env", "add", "VITE_PUBLIC_API_PROVIDER", "production", "--value", "apps-script"])
      })
    );
    expectSafeOutput(output);
  });

  it("returns FAILED after mutation if frontend verification fails", async () => {
    const executeCommand = vi.fn(async () => ({ code: 0 }));
    const fetchImpl = vi.fn(async (input: string) => {
      if (input === `${safeWorkerOrigin}/api/public/documents`) {
        return makeJsonResponse(makeSnapshot());
      }

      return makeJsonResponse({ error: "not ready" }, { ok: false, status: 500 });
    });
    const result = await runCutover(["--cutover", "--execute"], { fetchImpl, executeCommand });

    expect(result.status).toBe("FAILED");
    expect(result.manifest.checks.vercelMutation).toBe("passed");
    expect(result.manifest.checks.frontendSmoke).toBe("blocked");
    expect(executeCommand).toHaveBeenCalled();
  });

  it("validates safe HTML frontend smoke without printing full HTML", async () => {
    const fetchImpl = vi.fn(async (input: string) => {
      if (input === `${safeWorkerOrigin}/api/public/documents`) {
        return makeJsonResponse(makeSnapshot());
      }

      return makeHtmlResponse('<main data-public-document-list="ready">Sensitive page copy</main>');
    });
    const result = await runCutover(["--verify"], { fetchImpl });
    const output = formatPublicDocumentsProductionCutoverResult(result);

    expect(result.status).toBe("VERIFIED");
    expect(result.manifest.checks.frontendSmoke).toBe("passed");
    expect(output).not.toContain("Sensitive page copy");
    expectSafeOutput(output);
  });

  it("keeps text and JSON output redacted", async () => {
    const result = await runCutover(["--cutover", "--execute"]);
    const textOutput = formatPublicDocumentsProductionCutoverResult(result);
    const jsonOutput = formatPublicDocumentsProductionCutoverResult(result, { json: true });

    expect(textOutput).toContain("redacted-prod-doc-001");
    expect(textOutput).toContain("redacted-prod-doc-002");
    expect(textOutput).toContain("redacted-prod-doc-003");
    expect(textOutput).not.toContain("redacted-prod-doc-004");
    expectSafeOutput(textOutput);
    expectSafeOutput(jsonOutput);
    expect(JSON.parse(jsonOutput).verification.firstPublicItemIds).toEqual([
      "redacted-prod-doc-001",
      "redacted-prod-doc-002",
      "redacted-prod-doc-003"
    ]);
  });

  it("maps all result statuses to safe exit codes", () => {
    expect(getProductionCutoverExitCode("READY_PLAN")).toBe(0);
    expect(getProductionCutoverExitCode("CUTOVER_READY")).toBe(0);
    expect(getProductionCutoverExitCode("CUTOVER_APPLIED")).toBe(0);
    expect(getProductionCutoverExitCode("ROLLBACK_READY")).toBe(0);
    expect(getProductionCutoverExitCode("ROLLBACK_APPLIED")).toBe(0);
    expect(getProductionCutoverExitCode("VERIFIED")).toBe(0);
    expect(getProductionCutoverExitCode("BLOCKED")).toBe(1);
    expect(getProductionCutoverExitCode("FAILED")).toBe(1);
    expect(getProductionCutoverExitCode("UNEXPECTED")).toBe(1);
  });

  it("keeps committed repository guardrails and current frontend contract intact", () => {
    expect(wranglerToml).toContain('database_id = "local-placeholder"');
    expect(wranglerToml).toContain('database_id = "production-placeholder"');
    expect(wranglerToml).not.toMatch(realD1IdPattern);
    expect(publicApiProviderSource).toMatch(/VITE_CLOUDFLARE_PUBLIC_API_URL/);
    expect(publicApiProviderSource).toMatch(/CLOUDFLARE_PUBLIC_API_URL/);
    expect(publicApiProviderSource).not.toMatch(/VITE_PUBLIC_API_PROVIDER/);
    expect(publicApiProviderSource).not.toMatch(/apps-script/);
    expect(cutoverSource).not.toMatch(/d1\s+execute/i);
    expect(cutoverSource).not.toMatch(/d1\s+migrations/i);
    expect(cutoverSource).not.toMatch(/wrangler\s+deploy/i);
  });

  it("documents the M15 cutover and rollback gate without claiming execution", () => {
    expect(m15Doc).toMatch(
      /Status: production frontend cutover and rollback gate only\. Cutover is not executed without explicit approval\./i
    );
    expect(m15Doc).toMatch(/M15 is the only checkpoint that may switch frontend traffic for `public-document-list`/i);
    expect(m15Doc).toMatch(/M15 does not authorize any endpoint beyond `public-document-list`/i);
    expect(m15Doc).toMatch(/M15 does not change Apps Script/i);
    expect(m15Doc).toMatch(/M15 does not change `src\/services\/googleApi\.ts`/i);
    expect(m15Doc).toMatch(/M15 does not change UI\/routes\/cache/i);
    expect(m15Doc).toMatch(/M15 does not write D1/i);
    expect(m15Doc).toMatch(/M15 does not deploy Worker/i);
    expect(m15Doc).toMatch(/M15 does not run production import/i);
    expect(m15Doc).toMatch(/Actual production frontend cutover: not executed in this commit/i);
    expect(m15Doc).toMatch(/Apps Script remains rollback provider/i);
    expect(m15Doc).not.toMatch(forbiddenProductionPattern);
    expect(m15Doc).not.toMatch(realD1IdPattern);
  });
});
