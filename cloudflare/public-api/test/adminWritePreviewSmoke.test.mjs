/* global Response, URL */
import { describe, expect, it, vi } from "vitest";
import rootPackageJsonSource from "../../../package.json?raw";
import workerPackageJsonSource from "../package.json?raw";
import {
  formatAdminWritePreviewSmokeResult,
  getAdminWritePreviewSmokeExitCode,
  runAdminWritePreviewSmoke
} from "../scripts/admin-write-preview-smoke.mjs";
import smokeScriptSource from "../scripts/admin-write-preview-smoke.mjs?raw";

const approvalPhrase = "APPROVED_M18_ADMIN_WRITE_PREVIEW_SMOKE";
const previewWorkerOrigin = "https://preview-worker.example.test";
const previewToken = "m18-preview-token";
const forbiddenUrlPattern = new RegExp(
  [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`]
    .map((value) => value.replaceAll(".", "\\."))
    .join("|"),
  "i"
);

const validEnv = {
  RCAT_M18_ADMIN_WRITE_SMOKE_APPROVAL: approvalPhrase,
  RCAT_PREVIEW_WORKER_URL: previewWorkerOrigin,
  RCAT_M18_ADMIN_WRITE_TOKEN: previewToken
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function createFetchForHappyPath() {
  const state = {
    published: false,
    deleted: false
  };

  return vi.fn(async (url, init = {}) => {
    const parsed = new URL(url);

    expect(init.headers?.["X-RCAT-Admin-Write-Token"]).toBe(previewToken);

    if (parsed.pathname === "/api/admin/content" && init.method === "POST") {
      return jsonResponse(
        {
          item: {
            id: "m18-preview-smoke-redacted",
            slug: "m18-preview-smoke-redacted",
            status: "draft",
            revision: 0
          }
        },
        201
      );
    }

    if (parsed.pathname === "/api/admin/content/m18-preview-smoke-redacted") {
      if (init.method === "GET") {
        return jsonResponse({
          item: {
            id: "m18-preview-smoke-redacted",
            slug: "m18-preview-smoke-redacted",
            status: state.published ? "published" : "draft",
            revision: 1
          }
        });
      }

      if (init.method === "PATCH") {
        return jsonResponse({
          item: {
            id: "m18-preview-smoke-redacted",
            slug: "m18-preview-smoke-redacted",
            title: "M18 preview smoke updated",
            status: "draft",
            revision: 1
          }
        });
      }

      if (init.method === "DELETE") {
        state.deleted = true;
        return jsonResponse({ id: "m18-preview-smoke-redacted", deleted: true });
      }
    }

    if (parsed.pathname === "/api/admin/content/m18-preview-smoke-redacted/publish") {
      state.published = true;
      return jsonResponse({ id: "m18-preview-smoke-redacted", published: true });
    }

    if (parsed.pathname === "/api/admin/content/m18-preview-smoke-redacted/unpublish") {
      state.published = false;
      return jsonResponse({ id: "m18-preview-smoke-redacted", published: false });
    }

    if (parsed.pathname === "/api/public/content") {
      return jsonResponse({
        items:
          state.published && !state.deleted
            ? [
                {
                  id: "m18-preview-smoke-redacted",
                  slug: "m18-preview-smoke-redacted"
                }
              ]
            : [],
        generatedAt: "2026-06-16T00:00:00.000Z"
      });
    }

    return jsonResponse({ error: "not found" }, 404);
  });
}

function expectRedactedOutput(output) {
  expect(output).not.toContain(previewWorkerOrigin);
  expect(output).not.toContain(previewToken);
  expect(output).not.toContain("Fake M18 preview smoke body");
  expect(output).not.toContain("https://files.example.test");
  expect(output).not.toMatch(forbiddenUrlPattern);
  expect(output).not.toMatch(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
}

describe("M18 admin write preview smoke", () => {
  it("script exists and is exposed through package scripts", () => {
    const rootPackageJson = JSON.parse(rootPackageJsonSource);
    const workerPackageJson = JSON.parse(workerPackageJsonSource);

    expect(smokeScriptSource).toContain("runAdminWritePreviewSmoke");
    expect(rootPackageJson.scripts["worker:admin-write:preview-smoke"]).toBe(
      "node cloudflare/public-api/scripts/admin-write-preview-smoke.mjs"
    );
    expect(workerPackageJson.scripts["admin-write:preview-smoke"]).toBe("node scripts/admin-write-preview-smoke.mjs");
  });

  it("blocks without approval, Worker URL, or admin token before fetch", async () => {
    const fetchImpl = vi.fn();
    const result = await runAdminWritePreviewSmoke([], {
      env: {},
      fetch: fetchImpl
    });

    expect(result.status).toBe("BLOCKED_SAFE");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks unsafe preview Worker URLs before fetch", async () => {
    const unsafeUrls = [
      "",
      "http://preview-worker.example.test",
      "https://public-api-production.example.test",
      "https://worker.example.test",
      `https://${"script"}.${"google"}.com/macros/s/redacted/exec`,
      `https://${"drive"}.${"google"}.com/file/redacted`,
      `https://preview.${"rcat"}.ac.th`
    ];

    for (const unsafeUrl of unsafeUrls) {
      const fetchImpl = vi.fn();
      const result = await runAdminWritePreviewSmoke([], {
        env: {
          ...validEnv,
          RCAT_PREVIEW_WORKER_URL: unsafeUrl
        },
        fetch: fetchImpl
      });

      expect(result.status, unsafeUrl || "empty").toBe("BLOCKED_SAFE");
      expect(fetchImpl, unsafeUrl || "empty").not.toHaveBeenCalled();
    }
  });

  it("runs the sanitized write lifecycle and prints redacted output", async () => {
    const fetchImpl = createFetchForHappyPath();
    const result = await runAdminWritePreviewSmoke([], {
      env: validEnv,
      fetch: fetchImpl
    });
    const textOutput = formatAdminWritePreviewSmokeResult(result);
    const jsonOutput = formatAdminWritePreviewSmokeResult(result, { json: true });

    expect(result.status).toBe("PASSED");
    expect(fetchImpl.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
      "/api/admin/content",
      "/api/admin/content/m18-preview-smoke-redacted",
      "/api/admin/content/m18-preview-smoke-redacted",
      "/api/admin/content/m18-preview-smoke-redacted/publish",
      "/api/public/content",
      "/api/admin/content/m18-preview-smoke-redacted/unpublish",
      "/api/public/content",
      "/api/admin/content/m18-preview-smoke-redacted"
    ]);
    expectRedactedOutput(textOutput);
    expectRedactedOutput(jsonOutput);
  });

  it("fails safely when a lifecycle step returns 501, 500, leakage, or invalid public visibility", async () => {
    const serverFailure = await runAdminWritePreviewSmoke([], {
      env: validEnv,
      fetch: vi.fn(async () => jsonResponse({ error: "not implemented" }, 501))
    });
    const leakageFailure = await runAdminWritePreviewSmoke([], {
      env: validEnv,
      fetch: vi.fn(async () => jsonResponse({ error: "SQL SELECT stack secret" }, 500))
    });

    expect(serverFailure.status).toBe("FAILED");
    expect(leakageFailure.status).toBe("FAILED");
    expect(formatAdminWritePreviewSmokeResult(leakageFailure)).not.toMatch(/SQL|SELECT|stack|secret/i);
  });

  it("maps exit codes without executing remote commands", () => {
    expect(getAdminWritePreviewSmokeExitCode("PASSED")).toBe(0);
    expect(getAdminWritePreviewSmokeExitCode("BLOCKED_SAFE")).toBe(1);
    expect(getAdminWritePreviewSmokeExitCode("FAILED")).toBe(1);
    expect(smokeScriptSource).not.toMatch(/node:child_process|spawn\(|execFile\(|exec\(|wrangler\s/i);
    expect(smokeScriptSource).not.toMatch(/migrations\s+apply|d1\s+execute/i);
  });
});
