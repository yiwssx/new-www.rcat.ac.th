/* global AbortController, clearTimeout, console, fetch, process, setTimeout, URL */
import { pathToFileURL } from "node:url";

const CHECKPOINT = "M17-C";
const SCOPE = "cloudflare-core-public-read";
const APPROVAL_PHRASE = "APPROVED_M17_PUBLIC_READ_PREVIEW_SMOKE";
const REQUIRED_ENV = ["RCAT_M17_PUBLIC_READ_SMOKE_APPROVAL", "RCAT_PREVIEW_WORKER_URL"];
const SUCCESS_STATUSES = new Set(["PASSED"]);
const LOCAL_HOST_PATTERN = /(^localhost$|^127\.|^0\.0\.0\.0$|^\[?::1\]?$|\.localhost$)/i;
const PRODUCTION_HOST_PATTERN = /(^|[-_.])(prod|production|live)([-_.]|$)/i;
const DEV_PREVIEW_HOST_PATTERN = /(^|[-_.])(preview|dev)([-_.]|$)|workers\.dev$/i;
const FORBIDDEN_HOSTS = [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`];
const LEAKAGE_PATTERN = new RegExp(
  [
    "stack",
    "SQL",
    "SELECT",
    "\\bD1\\b",
    "file_url",
    "file_name",
    "media_id",
    "published_at",
    "sort_order",
    "body_doc_url",
    "drive_url",
    `${"script"}\\.${"google"}\\.com`,
    `${"drive"}\\.${"google"}\\.com`,
    `${"rcat"}\\.ac\\.th`,
    "token",
    "secret"
  ].join("|"),
  "i"
);

const ENDPOINTS = [
  {
    key: "documents",
    path: "/api/public/documents",
    requestPath: "/api/public/documents",
    acceptableStatuses: [200],
    validate: validateItemsSnapshot
  },
  {
    key: "home",
    path: "/api/public/home",
    requestPath: "/api/public/home",
    acceptableStatuses: [200],
    validate: validateHomeSnapshot
  },
  {
    key: "content-list",
    path: "/api/public/content",
    requestPath: "/api/public/content",
    acceptableStatuses: [200],
    validate: validateItemsSnapshot
  },
  {
    key: "content-detail",
    path: "/api/public/content/:slug",
    requestPath: "/api/public/content/sample-preview-news",
    acceptableStatuses: [200, 404],
    validate: validateContentDetailSnapshot
  },
  {
    key: "search",
    path: "/api/public/search",
    requestPath: "/api/public/search?q=sample",
    acceptableStatuses: [200],
    validate: validateSearchSnapshot
  },
  {
    key: "programs",
    path: "/api/public/programs",
    requestPath: "/api/public/programs",
    acceptableStatuses: [200],
    validate: validateItemsSnapshot
  },
  {
    key: "visitor-stats",
    path: "/api/public/visitor-stats",
    requestPath: "/api/public/visitor-stats",
    acceptableStatuses: [200],
    validate: validateVisitorStatsSnapshot
  }
];

function readEnv(env, key) {
  const value = env[key];

  return typeof value === "string" ? value.trim() : "";
}

function isStrictIsoString(value) {
  if (typeof value !== "string") {
    return false;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function hasForbiddenHostPart(hostname) {
  const normalizedHostname = hostname.toLowerCase();

  return FORBIDDEN_HOSTS.some((hostPart) => normalizedHostname.includes(hostPart));
}

function makeWorkerUrlLabel(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value ? "invalid-url" : "not-provided";
  }
}

function validateWorkerUrl(value) {
  const issues = [];
  let parsedUrl;

  if (!value) {
    return {
      parsedUrl: null,
      issues: ["RCAT_PREVIEW_WORKER_URL is required"]
    };
  }

  try {
    parsedUrl = new URL(value);
  } catch {
    return {
      parsedUrl: null,
      issues: ["RCAT_PREVIEW_WORKER_URL must be a valid HTTPS dev/preview Worker URL"]
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (parsedUrl.protocol !== "https:") {
    issues.push("RCAT_PREVIEW_WORKER_URL must use HTTPS");
  }

  if (LOCAL_HOST_PATTERN.test(hostname)) {
    issues.push("RCAT_PREVIEW_WORKER_URL must not use localhost");
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

  return { parsedUrl, issues };
}

function buildEndpointUrl(workerUrl, requestPath) {
  const parsedUrl = new URL(workerUrl);
  const basePath = parsedUrl.pathname.replace(/\/+$/, "");
  const [pathname, query = ""] = requestPath.split("?");

  parsedUrl.pathname = `${basePath}${pathname}`;
  parsedUrl.search = query ? `?${query}` : "";
  parsedUrl.hash = "";

  return parsedUrl.toString();
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

function makeChecks(value) {
  return {
    envGate: value,
    approvalGate: value,
    httpStatus: value,
    jsonParse: value,
    contract: value,
    leakage: value
  };
}

function makeEmptyManifest({ status, workerUrlLabel = "not-provided", issues = [] }) {
  return {
    checkpoint: CHECKPOINT,
    scope: SCOPE,
    status,
    target: {
      workerUrlLabel
    },
    endpoints: [],
    checks: makeChecks("blocked"),
    safety: {
      productionCutover: false,
      productionVercelEnvMutation: false,
      productionWorkerDeploy: false,
      productionD1Migration: false,
      productionD1Import: false,
      productionD1Write: false,
      appsScriptChanged: false,
      googleApiChanged: false,
      uiRoutesCacheChanged: false,
      adminWriteMigration: false,
      mediaUploadDeleteMigration: false
    },
    validationIssues: issues
  };
}

function makeEndpointSummary(endpoint, response, contract, payload) {
  return {
    key: endpoint.key,
    path: endpoint.path,
    status: response.status,
    contract,
    itemCount: Array.isArray(payload?.items)
      ? payload.items.length
      : Array.isArray(payload?.sections)
        ? payload.sections.length
        : typeof payload?.item === "object" && payload.item
          ? 1
          : null,
    generatedAt: isStrictIsoString(payload?.generatedAt) ? payload.generatedAt : null
  };
}

function validateGeneratedAt(payload, issues) {
  if (!isStrictIsoString(payload?.generatedAt)) {
    issues.push("generatedAt must be a strict ISO string");
  }
}

function validateItemsSnapshot(payload) {
  const issues = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return ["response must be an object"];
  }

  if (!Array.isArray(payload.items)) {
    issues.push("items must be an array");
  }

  validateGeneratedAt(payload, issues);

  return issues;
}

function validateHomeSnapshot(payload) {
  const issues = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return ["response must be an object"];
  }

  ["sections", "featuredContent", "featuredDocuments", "programs"].forEach((key) => {
    if (!Array.isArray(payload[key])) {
      issues.push(`${key} must be an array`);
    }
  });
  validateGeneratedAt(payload, issues);

  return issues;
}

function validateContentDetailSnapshot(payload, status) {
  if (status === 404) {
    return payload?.error === "not found" ? [] : ["404 content detail response must be safe not found JSON"];
  }

  const issues = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return ["response must be an object"];
  }

  if (!payload.item || typeof payload.item !== "object" || Array.isArray(payload.item)) {
    issues.push("item must be an object");
  }

  validateGeneratedAt(payload, issues);

  return issues;
}

function validateSearchSnapshot(payload) {
  const issues = validateItemsSnapshot(payload);

  if (typeof payload?.query !== "string") {
    issues.push("query must be a string");
  }

  return issues;
}

function validateVisitorStatsSnapshot(payload) {
  const issues = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return ["response must be an object"];
  }

  ["total", "today"].forEach((key) => {
    if (typeof payload[key] !== "number" || !Number.isFinite(payload[key])) {
      issues.push(`${key} must be a finite number`);
    }
  });
  validateGeneratedAt(payload, issues);

  return issues;
}

function validateLeakage(text) {
  return LEAKAGE_PATTERN.test(text) ? ["unsafe response text leakage detected"] : [];
}

async function fetchEndpoint({ endpoint, workerUrl, fetchImpl, timeoutMs }) {
  const endpointUrl = buildEndpointUrl(workerUrl, endpoint.requestPath);
  let response;

  try {
    const timed = withTimeout(
      (signal) =>
        fetchImpl(endpointUrl, {
          method: "GET",
          headers: { accept: "application/json" },
          signal
        }),
      timeoutMs
    );

    response = await timed.promise;
  } catch {
    return {
      summary: {
        key: endpoint.key,
        path: endpoint.path,
        status: null,
        contract: "blocked",
        itemCount: null,
        generatedAt: null
      },
      issues: [`${endpoint.key}: fetch failed or timed out`]
    };
  }

  const text = await response.text();
  const issues = [];

  if (!endpoint.acceptableStatuses.includes(response.status)) {
    issues.push(`${endpoint.key}: unexpected HTTP status ${response.status}`);
  }

  if (response.status === 501) {
    issues.push(`${endpoint.key}: 501 not implemented is not acceptable in M17-C`);
  }

  if (response.status >= 500) {
    issues.push(`${endpoint.key}: server error is not acceptable in M17-C`);
  }

  issues.push(...validateLeakage(text).map((message) => `${endpoint.key}: ${message}`));

  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    issues.push(`${endpoint.key}: response JSON could not be parsed`);
  }

  if (payload) {
    issues.push(...endpoint.validate(payload, response.status).map((message) => `${endpoint.key}: ${message}`));
  }

  return {
    summary: makeEndpointSummary(
      endpoint,
      response,
      response.status === 404 && endpoint.key === "content-detail" && issues.length === 0 ? "safe-404" : "public-json",
      payload
    ),
    issues
  };
}

export function getPublicReadPreviewSmokeExitCode(status) {
  return SUCCESS_STATUSES.has(status) ? 0 : 1;
}

export async function runPublicReadPreviewSmoke(args = [], options = {}) {
  void args;

  const env = options.env || process.env;
  const fetchImpl = options.fetch || fetch;
  const timeoutMs = 10000;
  const envValues = Object.fromEntries(REQUIRED_ENV.map((key) => [key, readEnv(env, key)]));
  const missingKeys = REQUIRED_ENV.filter((key) => envValues[key] === "");
  const workerUrlLabel = makeWorkerUrlLabel(envValues.RCAT_PREVIEW_WORKER_URL);
  const envIssues = [];
  const approvalIssues = [];

  if (missingKeys.length > 0) {
    envIssues.push(...missingKeys.map((key) => `missing env: ${key}`));
  }

  if (envValues.RCAT_PREVIEW_WORKER_URL) {
    envIssues.push(...validateWorkerUrl(envValues.RCAT_PREVIEW_WORKER_URL).issues);
  }

  if (envValues.RCAT_M17_PUBLIC_READ_SMOKE_APPROVAL !== APPROVAL_PHRASE) {
    approvalIssues.push(`RCAT_M17_PUBLIC_READ_SMOKE_APPROVAL must exactly match ${APPROVAL_PHRASE}`);
  }

  if (envIssues.length > 0 || approvalIssues.length > 0) {
    const manifest = makeEmptyManifest({
      status: "BLOCKED",
      workerUrlLabel,
      issues: [
        ...envIssues.map((message) => ({ endpoint: null, messages: [message] })),
        ...approvalIssues.map((message) => ({ endpoint: null, messages: [message] }))
      ]
    });

    manifest.checks.envGate = envIssues.length === 0 ? "passed" : "blocked";
    manifest.checks.approvalGate = approvalIssues.length === 0 ? "passed" : "blocked";

    return {
      status: manifest.status,
      manifest
    };
  }

  const endpointResults = await Promise.all(
    ENDPOINTS.map((endpoint) =>
      fetchEndpoint({
        endpoint,
        workerUrl: envValues.RCAT_PREVIEW_WORKER_URL,
        fetchImpl,
        timeoutMs
      })
    )
  );
  const validationIssues = endpointResults
    .filter((result) => result.issues.length > 0)
    .map((result) => ({
      endpoint: result.summary.path,
      messages: result.issues
    }));
  const manifest = makeEmptyManifest({
    status: validationIssues.length === 0 ? "PASSED" : "FAILED",
    workerUrlLabel,
    issues: validationIssues
  });

  manifest.endpoints = endpointResults.map((result) => result.summary);
  manifest.checks = {
    envGate: "passed",
    approvalGate: "passed",
    httpStatus: endpointResults.every((result) => result.summary.status !== null && result.summary.status < 500)
      ? "passed"
      : "blocked",
    jsonParse: validationIssues.some((issue) => issue.messages.some((message) => message.includes("JSON")))
      ? "blocked"
      : "passed",
    contract: validationIssues.some((issue) =>
      issue.messages.some(
        (message) =>
          message.includes("must be") ||
          message.includes("generatedAt") ||
          message.includes("404 content detail response")
      )
    )
      ? "blocked"
      : "passed",
    leakage: validationIssues.some((issue) => issue.messages.some((message) => message.includes("leakage")))
      ? "blocked"
      : "passed"
  };

  return {
    status: manifest.status,
    manifest
  };
}

export function formatPublicReadPreviewSmokeResult(result, options = {}) {
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
    "",
    "Endpoints:"
  ];

  manifest.endpoints.forEach((endpoint) => {
    lines.push(
      `- ${endpoint.path}: status ${endpoint.status ?? "n/a"}, contract ${endpoint.contract}, itemCount ${
        endpoint.itemCount ?? "n/a"
      }, generatedAt ${endpoint.generatedAt ?? "n/a"}`
    );
  });

  if (manifest.validationIssues.length > 0) {
    lines.push("", "Validation issues:");
    manifest.validationIssues.forEach((issue) => {
      issue.messages.forEach((message) => {
        lines.push(`- ${message}`);
      });
    });
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
    "No D1 migration, import, or write was run.",
    "No Apps Script changes were made."
  );

  return lines.join("\n");
}

export async function main() {
  const args = process.argv.slice(2);
  const result = await runPublicReadPreviewSmoke(args);

  console.log(formatPublicReadPreviewSmokeResult(result, { json: args.includes("--json") }));

  process.exitCode = getPublicReadPreviewSmokeExitCode(result.status);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
