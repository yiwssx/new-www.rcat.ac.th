import { describe, expect, it, vi } from "vitest";
import m14Doc from "../../../docs/architecture/m14-public-document-list-production-worker-smoke-2026-06-11.md?raw";
import rootPackageJsonSource from "../../../package.json?raw";
import publicApiProviderSource from "../../../src/config/publicApiProvider.ts?raw";
import {
  formatPublicDocumentsProductionWorkerSmokeResult,
  getProductionWorkerSmokeExitCode,
  runPublicDocumentsProductionWorkerSmoke
} from "../scripts/public-documents-production-worker-smoke.mjs";
import workerSmokeSource from "../scripts/public-documents-production-worker-smoke.mjs?raw";
import workerPackageJsonSource from "../package.json?raw";
import wranglerToml from "../wrangler.toml?raw";

const fixedGeneratedAt = "2026-06-11T00:00:00.000Z";
const safeWorkerOrigin = "https://public-api-production.example.invalid";
const forbiddenProductionPattern = new RegExp(
  [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`]
    .map((value) => value.replaceAll(".", "\\."))
    .join("|"),
  "i"
);
const realD1IdPattern = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;
const validEnv = {
  RCAT_PROD_WORKER_URL: safeWorkerOrigin,
  RCAT_PROD_WORKER_SMOKE_APPROVAL: "APPROVED_PRODUCTION_WORKER_SMOKE",
  RCAT_PROD_WORKER_SMOKE_OPERATOR: "redacted-operator"
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

function makeResponse(body: unknown, init: { ok?: boolean; status?: number; jsonThrows?: boolean } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    async json() {
      if (init.jsonThrows) {
        throw new Error("invalid json");
      }

      return body;
    }
  };
}

function makeSnapshot(items = validItems, generatedAt = "2026-06-11T10:00:00.000Z") {
  return { items, generatedAt };
}

function runSmoke(
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: ReturnType<typeof vi.fn>;
    args?: string[];
  } = {}
) {
  return runPublicDocumentsProductionWorkerSmoke(["--generated-at", fixedGeneratedAt, ...(options.args ?? [])], {
    env: options.env ?? validEnv,
    fetch: options.fetchImpl ?? vi.fn(async () => makeResponse(makeSnapshot()))
  });
}

function expectSafeOutput(output: string) {
  expect(output).not.toContain(safeWorkerOrigin);
  expect(output).not.toMatch(/https:\/\/files\.example\.test/);
  expect(output).not.toContain("Sensitive description should never print.");
  expect(output).not.toContain("Another sensitive description should never print.");
  expect(output).not.toContain("redacted-one.pdf");
  expect(output).not.toContain("Redacted document one");
  expect(output).not.toMatch(forbiddenProductionPattern);
  expect(output).not.toMatch(realD1IdPattern);
}

describe("M14 production Worker smoke gate", () => {
  it("script exists and is exposed through root and worker package scripts", () => {
    const rootPackageJson = JSON.parse(rootPackageJsonSource);
    const workerPackageJson = JSON.parse(workerPackageJsonSource);

    expect(workerSmokeSource).toContain("runPublicDocumentsProductionWorkerSmoke");
    expect(rootPackageJson.scripts["worker:public-documents:worker-smoke"]).toBe(
      "node cloudflare/public-api/scripts/public-documents-production-worker-smoke.mjs"
    );
    expect(workerPackageJson.scripts["public-documents:worker-smoke"]).toBe(
      "node scripts/public-documents-production-worker-smoke.mjs"
    );
  });

  it("blocks without required env or exact approval and never fetches", async () => {
    const fetchImpl = vi.fn();
    const noEnv = await runSmoke({ env: {}, fetchImpl });
    const wrongApproval = await runSmoke({
      env: { ...validEnv, RCAT_PROD_WORKER_SMOKE_APPROVAL: "approved" },
      fetchImpl
    });

    expect(noEnv.status).toBe("BLOCKED");
    expect(noEnv.manifest.checks.envGate).toBe("blocked");
    expect(wrongApproval.status).toBe("BLOCKED");
    expect(wrongApproval.manifest.checks.approvalGate).toBe("blocked");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks unsafe Worker URLs before any fetch", async () => {
    const unsafeUrls = [
      "http://public-api-production.example.test",
      "https://localhost",
      "https://127.0.0.1",
      "https://[::1]",
      "https://worker.localhost",
      "https://public-api-preview.example.test",
      "https://public-api-staging.example.test",
      "https://public-api-dev.example.test",
      "https://public-api-test.example.test",
      "https://public-api-sandbox.example.test",
      `https://${"script"}.${"google"}.com/macros/s/redacted/exec`,
      `https://${"drive"}.${"google"}.com/file/redacted`,
      `https://project-git-preview-redacted.${"ver"}${"cel"}.app`
    ];

    for (const unsafeUrl of unsafeUrls) {
      const fetchImpl = vi.fn();
      const result = await runSmoke({ env: { ...validEnv, RCAT_PROD_WORKER_URL: unsafeUrl }, fetchImpl });

      expect(result.status, unsafeUrl).toBe("BLOCKED");
      expect(result.manifest.checks.envGate, unsafeUrl).toBe("blocked");
      expect(fetchImpl, unsafeUrl).not.toHaveBeenCalled();
    }
  });

  it("passes with a valid mocked Worker response and only calls the documents endpoint", async () => {
    const fetchImpl = vi.fn(async () => makeResponse(makeSnapshot()));
    const result = await runSmoke({ fetchImpl, args: ["--expected-min-count", "2"] });
    const output = formatPublicDocumentsProductionWorkerSmokeResult(result);

    expect(result.status).toBe("PASSED");
    expect(result.manifest).toMatchObject({
      checkpoint: "M14",
      scope: "public-document-list",
      status: "PASSED",
      target: {
        workerUrlLabel: "public-api-production.example.invalid",
        endpoint: "/api/public/documents"
      },
      http: {
        status: 200,
        ok: true
      },
      snapshot: {
        itemCount: 4,
        expectedMinCount: 2,
        firstPublicItemIds: ["redacted-prod-doc-001", "redacted-prod-doc-002", "redacted-prod-doc-003"],
        generatedAt: "2026-06-11T10:00:00.000Z"
      }
    });
    expect(Object.values(result.manifest.checks)).toEqual(Object.keys(result.manifest.checks).map(() => "passed"));
    Object.values(result.manifest.safety).forEach((value) => expect(value).toBe(false));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(`${safeWorkerOrigin}/api/public/documents`, expect.any(Object));
    expectSafeOutput(output);
  });

  it("returns FAILED for fetch, HTTP, and JSON failures", async () => {
    const fetchFailure = await runSmoke({ fetchImpl: vi.fn(async () => Promise.reject(new Error("network"))) });
    const httpFailure = await runSmoke({ fetchImpl: vi.fn(async () => makeResponse({}, { ok: false, status: 503 })) });
    const jsonFailure = await runSmoke({ fetchImpl: vi.fn(async () => makeResponse({}, { jsonThrows: true })) });

    expect(fetchFailure.status).toBe("FAILED");
    expect(httpFailure.status).toBe("FAILED");
    expect(httpFailure.manifest.checks.httpStatus).toBe("blocked");
    expect(jsonFailure.status).toBe("FAILED");
    expect(jsonFailure.manifest.checks.jsonParse).toBe("blocked");
  });

  it("fails invalid snapshot contracts and field leakage", async () => {
    const cases = [
      { extra: true, ...makeSnapshot() },
      { items: "invalid", generatedAt: "2026-06-11T10:00:00.000Z" },
      { items: validItems, generatedAt: "2026-06-11" },
      makeSnapshot([{ ...validItems[0], unknown: "blocked" }]),
      makeSnapshot([{ ...validItems[0], status: "published" }]),
      makeSnapshot([{ ...validItems[0], file_url: "https://files.example.test/internal.pdf" }]),
      makeSnapshot([{ ...validItems[0], publishedAt: "2026-06-11" }]),
      makeSnapshot([{ ...validItems[0], order: "1" }]),
      makeSnapshot([{ ...validItems[0], pinned: "true" }])
    ];

    for (const snapshot of cases) {
      const result = await runSmoke({ fetchImpl: vi.fn(async () => makeResponse(snapshot)) });

      expect(result.status).toBe("FAILED");
      expect(
        result.manifest.checks.snapshotContract === "blocked" || result.manifest.checks.fieldLeakage === "blocked"
      ).toBe(true);
      expectSafeOutput(formatPublicDocumentsProductionWorkerSmokeResult(result));
    }
  });

  it("fails invalid ordering and minimum count checks", async () => {
    const invalidOrdering = makeSnapshot([
      { ...validItems[1], order: 2, pinned: false },
      { ...validItems[0], order: 1, pinned: true }
    ]);
    const orderingResult = await runSmoke({ fetchImpl: vi.fn(async () => makeResponse(invalidOrdering)) });
    const minimumCountResult = await runSmoke({ args: ["--expected-min-count", "5"] });

    expect(orderingResult.status).toBe("FAILED");
    expect(orderingResult.manifest.checks.ordering).toBe("blocked");
    expect(minimumCountResult.status).toBe("FAILED");
    expect(minimumCountResult.manifest.checks.minimumCount).toBe("blocked");
  });

  it("keeps text and JSON output redacted", async () => {
    const result = await runSmoke();
    const textOutput = formatPublicDocumentsProductionWorkerSmokeResult(result);
    const jsonOutput = formatPublicDocumentsProductionWorkerSmokeResult(result, { json: true });

    expect(textOutput).toContain("redacted-prod-doc-001");
    expect(textOutput).toContain("redacted-prod-doc-002");
    expect(textOutput).toContain("redacted-prod-doc-003");
    expect(textOutput).not.toContain("redacted-prod-doc-004");
    expectSafeOutput(textOutput);
    expectSafeOutput(jsonOutput);
    expect(JSON.parse(jsonOutput).snapshot.firstPublicItemIds).toEqual([
      "redacted-prod-doc-001",
      "redacted-prod-doc-002",
      "redacted-prod-doc-003"
    ]);
  });

  it("maps smoke statuses to safe CLI exit codes", () => {
    expect(getProductionWorkerSmokeExitCode("PASSED")).toBe(0);
    expect(getProductionWorkerSmokeExitCode("BLOCKED")).toBe(1);
    expect(getProductionWorkerSmokeExitCode("FAILED")).toBe(1);
    expect(getProductionWorkerSmokeExitCode("UNEXPECTED")).toBe(1);
  });

  it("does not include deployment, D1, shell, or Vercel env command hooks", () => {
    expect(workerSmokeSource).not.toContain("wrangler");
    expect(workerSmokeSource).not.toMatch(/d1\s+execute/i);
    expect(workerSmokeSource).not.toMatch(/d1\s+migrations/i);
    expect(workerSmokeSource).not.toContain("child_process");
    expect(workerSmokeSource).not.toMatch(/\bexec\b/);
    expect(workerSmokeSource).not.toContain("spawn");
    expect(workerSmokeSource).not.toMatch(/vercel\s+env/i);
  });

  it("keeps committed config and frontend provider safe", () => {
    expect(wranglerToml).toContain('database_id = "local-placeholder"');
    expect(wranglerToml).toContain('database_id = "preview-placeholder"');
    expect(wranglerToml).not.toMatch(realD1IdPattern);
    expect(publicApiProviderSource).toContain('return provider === "cloudflare" ? "cloudflare" : "apps-script"');
  });

  it("documents that M14 is direct Worker smoke only and not frontend cutover", () => {
    expect(m14Doc).toMatch(
      /Status: direct production Worker smoke gate only\. Production frontend cutover is not approved or executed\./i
    );
    expect(m14Doc).toMatch(/M14 verifies production Worker directly/i);
    expect(m14Doc).toMatch(/does not switch frontend to Cloudflare/i);
    expect(m14Doc).toMatch(/does not change Vercel production env/i);
    expect(m14Doc).toMatch(/does not deploy Worker/i);
    expect(m14Doc).toMatch(/does not write D1/i);
    expect(m14Doc).toMatch(/does not run production import/i);
    expect(m14Doc).toMatch(/does not change Apps Script/i);
    expect(m14Doc).toMatch(/does not change `src\/services\/googleApi\.ts`/i);
    expect(m14Doc).toMatch(/does not change UI\/routes\/cache/i);
    expect(m14Doc).toMatch(/Apps Script remains production source of truth/i);
    expect(m14Doc).toMatch(/does not authorize M15/i);
    expect(m14Doc).toMatch(/Actual production Worker smoke: not executed in this commit/i);
    expect(m14Doc).not.toMatch(forbiddenProductionPattern);
    expect(m14Doc).not.toMatch(realD1IdPattern);
  });
});
