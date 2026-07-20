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
const previewSmokeToken = "m18-preview-smoke-token";
const smokeActorEmail = "m18-preview-smoke@system.invalid";
const smokeActorRole = "admin";
const forbiddenUrlPattern = new RegExp(
  [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`]
    .map((value) => value.replaceAll(".", "\\."))
    .join("|"),
  "i"
);

const validEnv = {
  RCAT_M18_ADMIN_WRITE_SMOKE_APPROVAL: approvalPhrase,
  RCAT_PREVIEW_WORKER_URL: previewWorkerOrigin,
  RCAT_M18_ADMIN_WRITE_SMOKE_TOKEN: previewSmokeToken
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
    deleted: false,
    id: "",
    slug: ""
  };

  return vi.fn(async (url, init = {}) => {
    const parsed = new URL(url);

    expect(init.headers?.["X-RCAT-Admin-Smoke-Token"]).toBe(previewSmokeToken);
    expect(init.headers?.["X-RCAT-Admin-Proxy-Email"]).toBe(smokeActorEmail);
    expect(init.headers?.["X-RCAT-Admin-Proxy-Role"]).toBe(smokeActorRole);

    if (parsed.pathname === "/api/admin/content" && init.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}"));
      state.id = body.id;
      state.slug = body.slug;
      expect(state.id).toMatch(/^m18-preview-smoke-[a-z0-9-]+$/);
      expect(state.slug).toBe(state.id);
      expect(state.id).not.toBe("m18-preview-smoke-redacted");
      return jsonResponse(
        {
          item: {
            id: state.id,
            slug: state.slug,
            status: "draft",
            revision: 0
          }
        },
        201
      );
    }

    if (parsed.pathname === `/api/admin/content/${state.id}`) {
      if (init.method === "GET") {
        if (state.deleted) {
          return jsonResponse({ error: "not found" }, 404);
        }

        return jsonResponse({
          item: {
            id: state.id,
            slug: state.slug,
            status: state.published ? "published" : "draft",
            revision: state.published ? 2 : 1
          }
        });
      }

      if (init.method === "PATCH") {
        return jsonResponse({
          item: {
            id: state.id,
            slug: state.slug,
            title: "M18 preview smoke updated",
            status: "draft",
            revision: 1
          }
        });
      }

      if (init.method === "DELETE") {
        state.deleted = true;
        return jsonResponse({ id: state.id, deleted: true });
      }
    }

    if (parsed.pathname === `/api/admin/content/${state.id}/publish`) {
      state.published = true;
      return jsonResponse({ id: state.id, published: true });
    }

    if (parsed.pathname === `/api/admin/content/${state.id}/unpublish`) {
      state.published = false;
      return jsonResponse({ id: state.id, published: false });
    }

    if (parsed.pathname === "/api/public/content") {
      return jsonResponse({
        items:
          state.published && !state.deleted
            ? [
                {
                  id: state.id,
                  slug: state.slug
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
  expect(output).not.toContain(previewSmokeToken);
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
    const paths = fetchImpl.mock.calls.map(([url]) => new URL(url).pathname);
    const smokeId = paths[1].replace("/api/admin/content/", "");

    expect(paths).toEqual([
      "/api/admin/content",
      `/api/admin/content/${smokeId}`,
      `/api/admin/content/${smokeId}`,
      `/api/admin/content/${smokeId}/publish`,
      "/api/public/content",
      `/api/admin/content/${smokeId}/unpublish`,
      "/api/public/content",
      `/api/admin/content/${smokeId}`,
      `/api/admin/content/${smokeId}`,
      "/api/public/content"
    ]);
    expect(result.manifest.checks.publicReadAfterPublish).toBe("passed");
    expect(result.manifest.checks.publicReadAfterUnpublish).toBe("passed");
    expect(result.manifest.checks.cleanup).toBe("passed");
    fetchImpl.mock.calls.forEach(([, init]) => {
      expect(init.headers?.["X-RCAT-Admin-Proxy-Email"]).toBe(smokeActorEmail);
      expect(init.headers?.["X-RCAT-Admin-Proxy-Role"]).toBe(smokeActorRole);
    });
    expectRedactedOutput(textOutput);
    expectRedactedOutput(jsonOutput);
  });

  it("sends the latest cleanup revision through the custom header without a DELETE JSON body", async () => {
    let smokeId = "";
    let published = false;
    let deleted = false;
    const deleteHeaders = [];
    const deleteBodies = [];
    const fetchImpl = vi.fn(async (url, init = {}) => {
      const parsed = new URL(url);

      expect(init.headers?.["X-RCAT-Admin-Smoke-Token"]).toBe(previewSmokeToken);
      expect(init.headers?.["X-RCAT-Admin-Proxy-Email"]).toBe(smokeActorEmail);
      expect(init.headers?.["X-RCAT-Admin-Proxy-Role"]).toBe(smokeActorRole);

      if (parsed.pathname === "/api/admin/content" && init.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}"));
        smokeId = body.id;
        return jsonResponse({ item: { id: smokeId, slug: body.slug, status: "draft", revision: 0 } }, 201);
      }

      if (parsed.pathname === `/api/admin/content/${smokeId}` && init.method === "GET") {
        if (deleted) {
          return jsonResponse({ error: "not found" }, 404);
        }

        return jsonResponse({ item: { id: smokeId, slug: smokeId, status: "draft", revision: 1 } });
      }

      if (parsed.pathname === `/api/admin/content/${smokeId}` && init.method === "PATCH") {
        return jsonResponse({ item: { id: smokeId, slug: smokeId, status: "draft", revision: 2 } });
      }

      if (parsed.pathname === `/api/admin/content/${smokeId}/publish`) {
        published = true;
        return jsonResponse({ id: smokeId, published: true });
      }

      if (parsed.pathname === `/api/admin/content/${smokeId}/unpublish`) {
        published = false;
        return jsonResponse({ id: smokeId, published: false });
      }

      if (parsed.pathname === `/api/admin/content/${smokeId}` && init.method === "DELETE") {
        deleted = true;
        deleteHeaders.push(init.headers);
        deleteBodies.push(init.body);
        return jsonResponse({ id: smokeId, deleted: true });
      }

      if (parsed.pathname === "/api/public/content") {
        return jsonResponse({ items: published ? [{ id: smokeId, slug: smokeId }] : [] });
      }

      return jsonResponse({ error: "not found" }, 404);
    });

    const result = await runAdminWritePreviewSmoke([], {
      env: validEnv,
      fetch: fetchImpl
    });

    expect(result.status).toBe("PASSED");
    expect(deleteHeaders).toHaveLength(1);
    expect(deleteHeaders[0]?.["X-RCAT-Expected-Revision"]).toBe("4");
    expect(deleteHeaders[0]?.["If-Match"]).toBeUndefined();
    expect(deleteBodies).toEqual([undefined]);
  });

  it("uses a unique smoke identity per run and never hard-codes the redacted placeholder as the record identity", async () => {
    const firstFetch = createFetchForHappyPath();
    const secondFetch = createFetchForHappyPath();
    const first = await runAdminWritePreviewSmoke([], {
      env: validEnv,
      fetch: firstFetch
    });
    const second = await runAdminWritePreviewSmoke([], {
      env: validEnv,
      fetch: secondFetch
    });
    const firstId = new URL(firstFetch.mock.calls[1][0]).pathname.replace("/api/admin/content/", "");
    const secondId = new URL(secondFetch.mock.calls[1][0]).pathname.replace("/api/admin/content/", "");

    expect(first.status).toBe("PASSED");
    expect(second.status).toBe("PASSED");
    expect(firstId).not.toBe(secondId);
    expect(firstId).not.toBe("m18-preview-smoke-redacted");
    expect(secondId).not.toBe("m18-preview-smoke-redacted");
  });

  it("attempts cleanup for the current run record after a post-create failure", async () => {
    let smokeId = "";
    let deleted = false;
    const fetchImpl = vi.fn(async (url, init = {}) => {
      const parsed = new URL(url);

      if (parsed.pathname === "/api/admin/content" && init.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}"));
        smokeId = body.id;
        return jsonResponse({ item: { id: smokeId, slug: body.slug, revision: 0 } }, 201);
      }

      if (parsed.pathname === `/api/admin/content/${smokeId}` && init.method === "GET") {
        if (deleted) {
          return jsonResponse({ error: "not found" }, 404);
        }

        return jsonResponse({ error: "read failed" }, 500);
      }

      if (parsed.pathname === `/api/admin/content/${smokeId}` && init.method === "DELETE") {
        deleted = true;
        return jsonResponse({ id: smokeId, deleted: true });
      }

      if (parsed.pathname === "/api/public/content") {
        return jsonResponse({ items: [] });
      }

      return jsonResponse({ error: "unexpected path" }, 404);
    });
    const result = await runAdminWritePreviewSmoke([], {
      env: validEnv,
      fetch: fetchImpl
    });

    expect(result.status).toBe("FAILED");
    expect(fetchImpl.mock.calls.map(([url]) => new URL(url).pathname)).toContain(`/api/admin/content/${smokeId}`);
    expect(result.manifest.checks.cleanupAttempted).toBe("passed");
    expect(result.manifest.checks.cleanup).toBe("passed");
  });

  it("fails the overall result when cleanup fails", async () => {
    let smokeId = "";
    const fetchImpl = vi.fn(async (url, init = {}) => {
      const parsed = new URL(url);

      if (parsed.pathname === "/api/admin/content" && init.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}"));
        smokeId = body.id;
        return jsonResponse({ item: { id: smokeId, slug: body.slug, revision: 0 } }, 201);
      }

      if (parsed.pathname === `/api/admin/content/${smokeId}` && init.method === "GET") {
        return jsonResponse({ error: "read failed" }, 500);
      }

      if (parsed.pathname === `/api/admin/content/${smokeId}` && init.method === "DELETE") {
        return jsonResponse({ error: "cleanup failed" }, 500);
      }

      return jsonResponse({ error: "unexpected path" }, 404);
    });
    const result = await runAdminWritePreviewSmoke([], {
      env: validEnv,
      fetch: fetchImpl
    });

    expect(result.status).toBe("FAILED");
    expect(result.manifest.checks.cleanupAttempted).toBe("passed");
    expect(result.manifest.checks.cleanup).toBe("blocked");
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
