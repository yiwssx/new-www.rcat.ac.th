/* global Response, URL, URLSearchParams */
import { describe, expect, it, vi } from "vitest";
import rootPackageJsonSource from "../../../package.json?raw";
import workerPackageJsonSource from "../package.json?raw";
import {
  formatPublicReadPreviewSmokeResult,
  getPublicReadPreviewSmokeExitCode,
  runPublicReadPreviewSmoke
} from "../scripts/public-read-preview-smoke.mjs";
import smokeScriptSource from "../scripts/public-read-preview-smoke.mjs?raw";

const approvalPhrase = "APPROVED_M17_PUBLIC_READ_PREVIEW_SMOKE";
const previewWorkerOrigin = "https://preview-worker.example.test";
const generatedAt = "2026-06-13T00:00:00.000Z";
const forbiddenUrlPattern = new RegExp(
  [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`]
    .map((value) => value.replaceAll(".", "\\."))
    .join("|"),
  "i"
);

const validEnv = {
  RCAT_M17_PUBLIC_READ_SMOKE_APPROVAL: approvalPhrase,
  RCAT_PREVIEW_WORKER_URL: previewWorkerOrigin
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function makeSafeBody(pathname, searchParams = new URLSearchParams()) {
  if (pathname === "/api/public/documents") {
    return {
      items: [
        {
          id: "sample-public-document-001",
          title: "Sample public document",
          description: "This description must not be printed.",
          category: "sample",
          fileUrl: "https://files.example.test/document.pdf",
          fileName: "document.pdf",
          mediaId: "sample-media-001",
          publishedAt: generatedAt,
          order: 1,
          pinned: true,
          updatedAt: generatedAt
        }
      ],
      generatedAt
    };
  }

  if (pathname === "/api/public/home") {
    return {
      sections: [{ id: "sample-section-001", key: "intro" }],
      featuredContent: [{ id: "sample-content-001", slug: "sample-preview-news" }],
      featuredDocuments: [{ id: "sample-public-document-001" }],
      programs: [{ id: "sample-program-001", slug: "sample-preview-program" }],
      generatedAt
    };
  }

  if (pathname === "/api/public/content") {
    return {
      items: [{ id: "sample-content-001", slug: "sample-preview-news" }],
      generatedAt
    };
  }

  if (pathname === "/api/public/content/sample-preview-news") {
    return {
      item: { id: "sample-content-001", slug: "sample-preview-news" },
      generatedAt
    };
  }

  if (pathname === "/api/public/search") {
    return {
      query: searchParams.get("q") ?? "",
      items: [{ id: "sample-content-001", slug: "sample-preview-news" }],
      generatedAt
    };
  }

  if (pathname === "/api/public/programs") {
    return {
      items: [{ id: "sample-program-001", slug: "sample-preview-program" }],
      generatedAt
    };
  }

  if (pathname === "/api/public/visitor-stats") {
    return {
      total: 12,
      today: 3,
      generatedAt
    };
  }

  return { error: "not found" };
}

function makeSafeFetch(overrides = {}) {
  return vi.fn(async (url) => {
    const parsedUrl = new URL(url);
    const override = overrides[`${parsedUrl.pathname}${parsedUrl.search}`] ?? overrides[parsedUrl.pathname];

    if (override) {
      return override;
    }

    return jsonResponse(makeSafeBody(parsedUrl.pathname, parsedUrl.searchParams));
  });
}

async function runSmoke(options = {}) {
  return runPublicReadPreviewSmoke([], {
    env: options.env ?? validEnv,
    fetch: options.fetchImpl ?? makeSafeFetch()
  });
}

function expectSafeOutput(output) {
  expect(output).not.toContain(previewWorkerOrigin);
  expect(output).not.toContain("This description must not be printed.");
  expect(output).not.toContain("https://files.example.test/document.pdf");
  expect(output).not.toContain("Sample public document");
  expect(output).not.toMatch(forbiddenUrlPattern);
  expect(output).not.toMatch(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
}

describe("M17-C public read preview smoke", () => {
  it("script exists and is exposed through root and worker package scripts", () => {
    const rootPackageJson = JSON.parse(rootPackageJsonSource);
    const workerPackageJson = JSON.parse(workerPackageJsonSource);

    expect(smokeScriptSource).toContain("runPublicReadPreviewSmoke");
    expect(rootPackageJson.scripts["worker:public-read:preview-smoke"]).toBe(
      "node cloudflare/public-api/scripts/public-read-preview-smoke.mjs"
    );
    expect(workerPackageJson.scripts["public-read:preview-smoke"]).toBe("node scripts/public-read-preview-smoke.mjs");
  });

  it("blocks without the exact approval phrase and never fetches", async () => {
    const fetchImpl = vi.fn();
    const missing = await runSmoke({ env: {}, fetchImpl });
    const wrong = await runSmoke({
      env: {
        RCAT_PREVIEW_WORKER_URL: previewWorkerOrigin,
        RCAT_M17_PUBLIC_READ_SMOKE_APPROVAL: "approved"
      },
      fetchImpl
    });

    expect(missing.status).toBe("BLOCKED");
    expect(wrong.status).toBe("BLOCKED");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks unsafe Worker URLs before fetch", async () => {
    const unsafeUrls = [
      "",
      "http://preview-worker.example.test",
      "https://worker.example.test",
      "https://public-api-production.example.test",
      "https://public-api-live.example.test",
      `https://${"script"}.${"google"}.com/macros/s/redacted/exec`,
      `https://${"drive"}.${"google"}.com/file/redacted`,
      `https://preview.${"rcat"}.ac.th`
    ];

    for (const unsafeUrl of unsafeUrls) {
      const fetchImpl = vi.fn();
      const result = await runSmoke({
        env: {
          ...validEnv,
          RCAT_PREVIEW_WORKER_URL: unsafeUrl
        },
        fetchImpl
      });

      expect(result.status, unsafeUrl || "empty").toBe("BLOCKED");
      expect(fetchImpl, unsafeUrl || "empty").not.toHaveBeenCalled();
    }
  });

  it("passes valid safe responses for every scoped M17 public read endpoint", async () => {
    const fetchImpl = makeSafeFetch();
    const result = await runSmoke({ fetchImpl });
    const output = formatPublicReadPreviewSmokeResult(result);

    expect(result.status).toBe("PASSED");
    expect(fetchImpl).toHaveBeenCalledTimes(7);
    expect(fetchImpl.mock.calls.map(([url]) => new URL(url).pathname + new URL(url).search)).toEqual([
      "/api/public/documents",
      "/api/public/home",
      "/api/public/content",
      "/api/public/content/sample-preview-news",
      "/api/public/search?q=sample",
      "/api/public/programs",
      "/api/public/visitor-stats"
    ]);
    expect(Object.values(result.manifest.checks)).toEqual(Object.keys(result.manifest.checks).map(() => "passed"));
    expect(result.manifest.endpoints.map((endpoint) => endpoint.status)).toEqual([200, 200, 200, 200, 200, 200, 200]);
    expectSafeOutput(output);
    expectSafeOutput(formatPublicReadPreviewSmokeResult(result, { json: true }));
  });

  it("accepts a safe 404 only for content detail when the sample slug is not seeded", async () => {
    const result = await runSmoke({
      fetchImpl: makeSafeFetch({
        "/api/public/content/sample-preview-news": jsonResponse({ error: "not found", resource: "content-detail" }, 404)
      })
    });

    expect(result.status).toBe("PASSED");
    expect(result.manifest.endpoints.find((endpoint) => endpoint.path === "/api/public/content/:slug")).toMatchObject({
      status: 404,
      contract: "safe-404"
    });
  });

  it("fails 501 and 500 responses", async () => {
    const notImplemented = await runSmoke({
      fetchImpl: makeSafeFetch({
        "/api/public/home": jsonResponse({ error: "Not implemented", phase: "M17" }, 501)
      })
    });
    const serverError = await runSmoke({
      fetchImpl: makeSafeFetch({
        "/api/public/programs": jsonResponse({ error: "internal server error" }, 500)
      })
    });

    expect(notImplemented.status).toBe("FAILED");
    expect(serverError.status).toBe("FAILED");
  });

  it("fails unsafe response leakage", async () => {
    const result = await runSmoke({
      fetchImpl: makeSafeFetch({
        "/api/public/search?q=sample": new Response(
          JSON.stringify({
            items: [],
            query: "sample",
            generatedAt,
            debug: "SELECT * FROM contents with D1 stack and token"
          }),
          { status: 200 }
        )
      })
    });

    expect(result.status).toBe("FAILED");
    expect(result.manifest.checks.leakage).toBe("blocked");
    expectSafeOutput(formatPublicReadPreviewSmokeResult(result));
  });

  it("fails invalid public read response shapes", async () => {
    const result = await runSmoke({
      fetchImpl: makeSafeFetch({
        "/api/public/visitor-stats": jsonResponse({ total: "12", today: 3, generatedAt })
      })
    });

    expect(result.status).toBe("FAILED");
    expect(result.manifest.checks.contract).toBe("blocked");
  });

  it("does not include deployment, D1 write, shell, or Vercel env command hooks", () => {
    expect(smokeScriptSource).not.toContain("child_process");
    expect(smokeScriptSource).not.toMatch(/\bexec(?:File)?\s*\(/);
    expect(smokeScriptSource).not.toMatch(/\bspawn\s*\(/);
    expect(smokeScriptSource).not.toMatch(/\bwrangler\s+(?:d1|deploy)\b/i);
    expect(smokeScriptSource).not.toMatch(/\bvercel\s+env\b/i);
    expect(smokeScriptSource).not.toContain(`--${"execute"}`);
  });

  it("maps preview smoke statuses to safe CLI exit codes", () => {
    expect(getPublicReadPreviewSmokeExitCode("PASSED")).toBe(0);
    expect(getPublicReadPreviewSmokeExitCode("BLOCKED")).toBe(1);
    expect(getPublicReadPreviewSmokeExitCode("FAILED")).toBe(1);
    expect(getPublicReadPreviewSmokeExitCode("UNEXPECTED")).toBe(1);
  });
});
