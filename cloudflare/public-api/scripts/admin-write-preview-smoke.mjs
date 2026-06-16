/* global AbortController, clearTimeout, console, fetch, process, setTimeout, URL */
import { pathToFileURL } from "node:url";

const CHECKPOINT = "M18";
const SCOPE = "admin-d1-write-batch";
const APPROVAL_PHRASE = "APPROVED_M18_ADMIN_WRITE_PREVIEW_SMOKE";
const REQUIRED_ENV = ["RCAT_M18_ADMIN_WRITE_SMOKE_APPROVAL", "RCAT_PREVIEW_WORKER_URL", "RCAT_M18_ADMIN_WRITE_TOKEN"];
const SUCCESS_STATUSES = new Set(["PASSED"]);
const LOCAL_HOST_PATTERN = /(^localhost$|^127\.|^0\.0\.0\.0$|^\[?::1\]?$|\.localhost$)/i;
const PRODUCTION_HOST_PATTERN = /(^|[-_.])(prod|production|live)([-_.]|$)/i;
const DEV_PREVIEW_HOST_PATTERN = /(^|[-_.])(preview|dev|staging|sandbox)([-_.]|$)|workers\.dev$/i;
const FORBIDDEN_HOSTS = [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`];
const LEAKAGE_PATTERN = new RegExp(
  [
    "stack",
    "SQL",
    "SELECT",
    "\\bD1\\b",
    "database_id",
    "account_id",
    "token",
    "secret",
    "password",
    `${"script"}\\.${"google"}\\.com`,
    `${"drive"}\\.${"google"}\\.com`,
    `${"rcat"}\\.ac\\.th`
  ].join("|"),
  "i"
);

function readEnv(env, key) {
  const value = env[key];

  return typeof value === "string" ? value.trim() : "";
}

function makeWorkerUrlLabel(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value ? "invalid-url" : "not-provided";
  }
}

function hasForbiddenHostPart(hostname) {
  const normalizedHostname = hostname.toLowerCase();

  return FORBIDDEN_HOSTS.some((hostPart) => normalizedHostname.includes(hostPart));
}

function validateWorkerUrl(value) {
  const issues = [];
  let parsedUrl;

  if (!value) {
    return ["RCAT_PREVIEW_WORKER_URL is required"];
  }

  try {
    parsedUrl = new URL(value);
  } catch {
    return ["RCAT_PREVIEW_WORKER_URL must be a valid HTTPS dev/preview Worker URL"];
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (parsedUrl.protocol !== "https:") {
    issues.push("RCAT_PREVIEW_WORKER_URL must use HTTPS");
  }

  if (LOCAL_HOST_PATTERN.test(hostname)) {
    issues.push("RCAT_PREVIEW_WORKER_URL must not use localhost for remote preview smoke");
  }

  if (PRODUCTION_HOST_PATTERN.test(hostname)) {
    issues.push("RCAT_PREVIEW_WORKER_URL must not look like production");
  }

  if (!DEV_PREVIEW_HOST_PATTERN.test(hostname)) {
    issues.push("RCAT_PREVIEW_WORKER_URL must look like a dev or preview Worker origin");
  }

  if (hasForbiddenHostPart(hostname)) {
    issues.push("RCAT_PREVIEW_WORKER_URL must not include forbidden production, Apps Script, or storage hosts");
  }

  return issues;
}

function buildUrl(workerUrl, path) {
  const parsedUrl = new URL(workerUrl);
  const basePath = parsedUrl.pathname.replace(/\/+$/, "");

  parsedUrl.pathname = `${basePath}${path}`;
  parsedUrl.search = "";
  parsedUrl.hash = "";

  return parsedUrl.toString();
}

function makeChecks(value) {
  return {
    envGate: value,
    approvalGate: value,
    urlSafety: value,
    credentialProvided: value,
    adminWrite: value,
    adminReadAfterWrite: value,
    publicReadAfterPublish: value,
    publicReadAfterUnpublish: value,
    cleanup: value,
    leakage: value
  };
}

function makeManifest({ status, workerUrlLabel = "not-provided", runId = null, issues = [] }) {
  return {
    checkpoint: CHECKPOINT,
    scope: SCOPE,
    status,
    runId,
    target: {
      workerUrlLabel
    },
    checks: makeChecks(status === "PASSED" ? "passed" : "blocked"),
    operations: [],
    safety: {
      productionCutover: false,
      productionVercelEnvMutation: false,
      productionWorkerDeploy: false,
      productionD1Migration: false,
      productionD1Import: false,
      productionD1Write: false,
      appsScriptChanged: false,
      googleApiChanged: false,
      mediaFileHandlingChanged: false
    },
    validationIssues: issues
  };
}

function makeRunId() {
  return `m18-preview-smoke-${Date.now()}`;
}

function makeSmokeContent(runId) {
  return {
    id: "m18-preview-smoke-redacted",
    title: `M18 preview smoke ${runId}`,
    slug: "m18-preview-smoke-redacted",
    type: "news",
    status: "draft",
    owner: "preview-smoke",
    summary: "Fake M18 preview smoke summary.",
    body: "Fake M18 preview smoke body.",
    category: "m18-preview",
    tags: ["m18", "preview"],
    featured: false,
    mediaIds: ["m18-preview-media-reference"],
    publishAt: new Date().toISOString()
  };
}

function redactIssue(message) {
  return String(message || "")
    .replace(/https?:\/\/\S+/gi, "<redacted-url>")
    .replace(/[A-Za-z0-9_-]{20,}/g, "<redacted-value>")
    .replace(LEAKAGE_PATTERN, "<redacted-sensitive-marker>");
}

function validateLeakage(text) {
  return LEAKAGE_PATTERN.test(text) ? ["unsafe response leakage detected"] : [];
}

function withTimeout(fetchPromise, timeoutMs) {
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      reject(new Error("request timed out"));
    }, timeoutMs);
  });

  return {
    signal: controller?.signal,
    promise: Promise.race([fetchPromise(controller?.signal), timeoutPromise]).finally(() => clearTimeout(timeoutId))
  };
}

async function requestJson({ workerUrl, path, method, token, body, fetchImpl, timeoutMs }) {
  const timed = withTimeout(
    (signal) =>
      fetchImpl(buildUrl(workerUrl, path), {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-RCAT-Admin-Write-Token": token
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal
      }),
    timeoutMs
  );
  const response = await timed.promise;
  const text = await response.text();
  const issues = [];

  if (response.status === 501 || response.status >= 500) {
    issues.push(`unsafe HTTP status ${response.status}`);
  }

  issues.push(...validateLeakage(text));

  let payload = null;

  try {
    payload = JSON.parse(text);
  } catch {
    issues.push("response JSON could not be parsed");
  }

  return {
    status: response.status,
    payload,
    issues
  };
}

function contentAppearsInPublic(payload, contentId) {
  return Array.isArray(payload?.items) && payload.items.some((item) => item?.id === contentId);
}

function operation(name, result) {
  return {
    name,
    status: result.status,
    ok: result.issues.length === 0 && result.status >= 200 && result.status < 300
  };
}

export function getAdminWritePreviewSmokeExitCode(status) {
  return SUCCESS_STATUSES.has(status) ? 0 : 1;
}

export async function runAdminWritePreviewSmoke(args = [], options = {}) {
  void args;

  const env = options.env || process.env;
  const fetchImpl = options.fetch || fetch;
  const timeoutMs = 10000;
  const envValues = Object.fromEntries(REQUIRED_ENV.map((key) => [key, readEnv(env, key)]));
  const missingKeys = REQUIRED_ENV.filter((key) => envValues[key] === "");
  const workerUrlLabel = makeWorkerUrlLabel(envValues.RCAT_PREVIEW_WORKER_URL);
  const issues = [];

  if (missingKeys.length > 0) {
    issues.push(...missingKeys.map((key) => `missing env: ${key}`));
  }

  if (envValues.RCAT_M18_ADMIN_WRITE_SMOKE_APPROVAL !== APPROVAL_PHRASE) {
    issues.push(`RCAT_M18_ADMIN_WRITE_SMOKE_APPROVAL must exactly match ${APPROVAL_PHRASE}`);
  }

  issues.push(...validateWorkerUrl(envValues.RCAT_PREVIEW_WORKER_URL));

  if (issues.length > 0) {
    return {
      status: "BLOCKED_SAFE",
      manifest: makeManifest({
        status: "BLOCKED_SAFE",
        workerUrlLabel,
        issues: issues.map(redactIssue)
      })
    };
  }

  const runId = makeRunId();
  const content = makeSmokeContent(runId);
  const operations = [];
  const validationIssues = [];

  async function step(name, path, method, body) {
    try {
      const result = await requestJson({
        workerUrl: envValues.RCAT_PREVIEW_WORKER_URL,
        path,
        method,
        token: envValues.RCAT_M18_ADMIN_WRITE_TOKEN,
        body,
        fetchImpl,
        timeoutMs
      });
      operations.push(operation(name, result));

      if (result.issues.length > 0 || result.status < 200 || result.status >= 300) {
        validationIssues.push(`${name}: ${result.issues.concat(`HTTP ${result.status}`).map(redactIssue).join("; ")}`);
      }

      return result;
    } catch {
      operations.push({ name, status: null, ok: false });
      validationIssues.push(`${name}: request failed or timed out`);
      return { status: null, payload: null, issues: ["request failed"] };
    }
  }

  const createResult = await step("create-draft", "/api/admin/content", "POST", content);
  const contentId = createResult.payload?.item?.id || content.id;

  if (validationIssues.length === 0) {
    await step("admin-read-after-write", `/api/admin/content/${encodeURIComponent(contentId)}`, "GET");
  }

  if (validationIssues.length === 0) {
    await step("update-draft", `/api/admin/content/${encodeURIComponent(contentId)}`, "PATCH", {
      ...content,
      title: "M18 preview smoke updated",
      expectedRevision: 0
    });
  }

  if (validationIssues.length === 0) {
    await step("publish", `/api/admin/content/${encodeURIComponent(contentId)}/publish`, "POST", {});
  }

  if (validationIssues.length === 0) {
    const publicAfterPublish = await step("public-read-after-publish", "/api/public/content", "GET");

    if (!contentAppearsInPublic(publicAfterPublish.payload, contentId)) {
      validationIssues.push("public-read-after-publish: smoke record was not visible");
    }
  }

  if (validationIssues.length === 0) {
    await step("unpublish", `/api/admin/content/${encodeURIComponent(contentId)}/unpublish`, "POST", {});
  }

  if (validationIssues.length === 0) {
    const publicAfterUnpublish = await step("public-read-after-unpublish", "/api/public/content", "GET");

    if (contentAppearsInPublic(publicAfterUnpublish.payload, contentId)) {
      validationIssues.push("public-read-after-unpublish: smoke record remained visible");
    }
  }

  if (validationIssues.length === 0) {
    await step("archive-cleanup", `/api/admin/content/${encodeURIComponent(contentId)}`, "DELETE");
  }

  const status = validationIssues.length === 0 ? "PASSED" : "FAILED";
  const manifest = makeManifest({
    status,
    workerUrlLabel,
    runId,
    issues: validationIssues.map(redactIssue)
  });

  manifest.operations = operations;
  manifest.checks = {
    envGate: "passed",
    approvalGate: "passed",
    urlSafety: "passed",
    credentialProvided: "passed",
    adminWrite: operations.some((item) => item.name === "create-draft" && item.ok) ? "passed" : "blocked",
    adminReadAfterWrite: operations.some((item) => item.name === "admin-read-after-write" && item.ok)
      ? "passed"
      : "blocked",
    publicReadAfterPublish: operations.some((item) => item.name === "public-read-after-publish" && item.ok)
      ? "passed"
      : "blocked",
    publicReadAfterUnpublish: operations.some((item) => item.name === "public-read-after-unpublish" && item.ok)
      ? "passed"
      : "blocked",
    cleanup: operations.some((item) => item.name === "archive-cleanup" && item.ok) ? "passed" : "blocked",
    leakage: validationIssues.some((issue) => issue.includes("leakage")) ? "blocked" : "passed"
  };

  return {
    status,
    manifest
  };
}

export function formatAdminWritePreviewSmokeResult(result, options = {}) {
  const manifest = result.manifest;

  if (options.json) {
    return JSON.stringify(manifest, null, 2);
  }

  const lines = [
    manifest.status,
    "",
    `Checkpoint: ${manifest.checkpoint}`,
    `Scope: ${manifest.scope}`,
    `Worker URL label: ${manifest.target.workerUrlLabel}`,
    `Run ID: ${manifest.runId ?? "not-run"}`,
    "",
    "Operations:"
  ];

  manifest.operations.forEach((item) => {
    lines.push(`- ${item.name}: status ${item.status ?? "n/a"}, ok ${item.ok}`);
  });

  if (manifest.validationIssues.length > 0) {
    lines.push("", "Validation issues:");
    manifest.validationIssues.forEach((issue) => lines.push(`- ${issue}`));
  }

  lines.push("", "Checks:");
  Object.entries(manifest.checks).forEach(([key, value]) => {
    lines.push(`- ${key}: ${value}`);
  });

  lines.push(
    "",
    "No production cutover was performed.",
    "No production environment was changed.",
    "No production Worker deploy was run.",
    "No production D1 migration, import, or write was run.",
    "No Apps Script changes were made.",
    "Google Drive media-file operations remain outside this smoke."
  );

  return lines.join("\n");
}

export async function main() {
  const args = process.argv.slice(2);
  const result = await runAdminWritePreviewSmoke(args);

  console.log(formatAdminWritePreviewSmokeResult(result, { json: args.includes("--json") }));

  process.exitCode = getAdminWritePreviewSmokeExitCode(result.status);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
