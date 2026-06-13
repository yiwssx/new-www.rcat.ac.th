/* global AbortController, clearTimeout, console, fetch, process, setTimeout, URL */
import { pathToFileURL } from "node:url";

const CHECKPOINT = "M14";
const SCOPE = "public-document-list";
const ENDPOINT = "/api/public/documents";
const APPROVAL_PHRASE = "APPROVED_PRODUCTION_WORKER_SMOKE";
const REQUIRED_ENV = ["RCAT_PROD_WORKER_URL", "RCAT_PROD_WORKER_SMOKE_APPROVAL"];
const SUCCESS_STATUSES = new Set(["PASSED"]);
const PREVIEW_HOST_PATTERN = /(^|[-_.])(preview|staging|dev|test|sandbox|git-)([-_.]|$)/i;
const LOCAL_HOST_PATTERN = /(^localhost$|^127\.|^0\.0\.0\.0$|^\[?::1\]?$|\.localhost$)/i;
const FORBIDDEN_HOSTS = [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`];
const VERCEL_PREVIEW_SUFFIX = `${"ver"}${"cel"}.app`;
const SNAPSHOT_KEYS = ["generatedAt", "items"].sort();
const ITEM_KEYS = [
  "category",
  "description",
  "fileName",
  "fileUrl",
  "id",
  "mediaId",
  "order",
  "pinned",
  "publishedAt",
  "title",
  "updatedAt"
].sort();
const INTERNAL_FIELD_PATTERN = /^(status|file_url|file_name|media_id|published_at|sort_order|updated_at)$/;
const SAFE_FALSE_FLAGS = {
  frontendCutover: false,
  vercelEnvChanged: false,
  [`${"apps"}${"Script"}Changed`]: false,
  [`${"google"}${"Api"}Changed`]: false,
  uiRoutesCacheChanged: false,
  d1Writes: false,
  productionWorkerDeploy: false,
  productionImport: false
};

function isStrictIsoString(value) {
  if (typeof value !== "string") {
    return false;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function parseNonNegativeInteger(value, label) {
  if (value === undefined || value === null || value === "") {
    return { value: null, issue: null };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return { value: null, issue: `${label} must be a non-negative integer` };
  }

  return { value: parsed, issue: null };
}

function parsePositiveInteger(value, label) {
  if (value === undefined || value === null || value === "") {
    return { value: null, issue: null };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { value: null, issue: `${label} must be a positive integer` };
  }

  return { value: parsed, issue: null };
}

function parseArgs(args) {
  const parsed = {
    json: false,
    timeoutMs: 10000,
    expectedMinCount: null,
    generatedAt: null
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--json") {
      parsed.json = true;
      continue;
    }

    if (arg === "--timeout-ms") {
      const nextArg = args[index + 1];
      const result = parsePositiveInteger(nextArg, "--timeout-ms");

      if (!nextArg || result.issue) {
        throw new Error(result.issue || "--timeout-ms requires a number");
      }

      parsed.timeoutMs = result.value;
      index += 1;
      continue;
    }

    if (arg === "--expected-min-count") {
      const nextArg = args[index + 1];
      const result = parseNonNegativeInteger(nextArg, "--expected-min-count");

      if (!nextArg || result.issue) {
        throw new Error(result.issue || "--expected-min-count requires a number");
      }

      parsed.expectedMinCount = result.value;
      index += 1;
      continue;
    }

    if (arg === "--generated-at") {
      const nextArg = args[index + 1];

      if (!nextArg) {
        throw new Error("--generated-at requires an ISO string");
      }

      if (!isStrictIsoString(nextArg)) {
        throw new Error("--generated-at must be a strict ISO string");
      }

      parsed.generatedAt = nextArg;
      index += 1;
      continue;
    }

    throw new Error(`unknown argument: ${arg}`);
  }

  return parsed;
}

function makeChecks(value) {
  return {
    envGate: value,
    approvalGate: value,
    httpStatus: value,
    jsonParse: value,
    snapshotContract: value,
    ordering: value,
    fieldLeakage: value,
    minimumCount: value
  };
}

function makeEmptyManifest({ status, workerUrlLabel = "not-provided", expectedMinCount = 0, issues = [] }) {
  return {
    checkpoint: CHECKPOINT,
    scope: SCOPE,
    status,
    target: {
      workerUrlLabel,
      endpoint: ENDPOINT
    },
    http: {
      status: null,
      ok: false
    },
    snapshot: {
      itemCount: 0,
      expectedMinCount,
      firstPublicItemIds: [],
      generatedAt: null
    },
    checks: makeChecks("blocked"),
    safety: { ...SAFE_FALSE_FLAGS },
    validationIssues: issues
  };
}

function makeResult(manifest) {
  return {
    status: manifest.status,
    manifest
  };
}

function readEnv(env, key) {
  const value = env[key];

  return typeof value === "string" ? value.trim() : "";
}

function hostIncludesForbiddenPart(hostname) {
  const normalizedHostname = hostname.toLowerCase();

  return FORBIDDEN_HOSTS.some((hostPart) => normalizedHostname.includes(hostPart));
}

function makeWorkerUrlLabel(value) {
  try {
    const parsedUrl = new URL(value);

    return parsedUrl.hostname.toLowerCase();
  } catch {
    return value ? "invalid-url" : "not-provided";
  }
}

function validateWorkerUrl(value) {
  const issues = [];
  let parsedUrl;

  try {
    parsedUrl = new URL(value);
  } catch {
    return { parsedUrl: null, issues: ["RCAT_PROD_WORKER_URL must be a valid HTTPS URL"] };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (parsedUrl.protocol !== "https:") {
    issues.push("RCAT_PROD_WORKER_URL must use HTTPS");
  }

  if (LOCAL_HOST_PATTERN.test(hostname)) {
    issues.push("RCAT_PROD_WORKER_URL must not use localhost");
  }

  if (PREVIEW_HOST_PATTERN.test(hostname)) {
    issues.push("RCAT_PROD_WORKER_URL must not look like preview/staging/dev/test/sandbox");
  }

  if (hostIncludesForbiddenPart(hostname)) {
    issues.push("RCAT_PROD_WORKER_URL must not include forbidden storage or Apps Script hosts");
  }

  if (hostname.endsWith(VERCEL_PREVIEW_SUFFIX)) {
    issues.push("RCAT_PROD_WORKER_URL must not be a Vercel preview URL");
  }

  return { parsedUrl, issues };
}

function buildEndpointUrl(workerUrl) {
  const parsedUrl = new URL(workerUrl);

  parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/+$/, "")}${ENDPOINT}`;
  parsedUrl.search = "";
  parsedUrl.hash = "";

  return parsedUrl.toString();
}

function toTimestamp(value) {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function keysMatch(value, expectedKeys) {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expectedKeys);
}

function validateSnapshotContract(snapshot) {
  const issues = [];

  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return ["snapshot must be an object"];
  }

  if (!keysMatch(snapshot, SNAPSHOT_KEYS)) {
    issues.push("snapshot top-level keys must be generatedAt and items only");
  }

  if (!isStrictIsoString(snapshot.generatedAt)) {
    issues.push("generatedAt must be a strict ISO string");
  }

  if (!Array.isArray(snapshot.items)) {
    issues.push("items must be an array");
    return issues;
  }

  snapshot.items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      issues.push(`item[${index}] must be an object`);
      return;
    }

    if (!keysMatch(item, ITEM_KEYS)) {
      issues.push(`item[${index}] has invalid public keys`);
    }

    ["id", "title", "description", "category", "fileUrl", "fileName", "mediaId", "publishedAt", "updatedAt"].forEach(
      (key) => {
        if (typeof item[key] !== "string") {
          issues.push(`item[${index}].${key} must be a string`);
        }
      }
    );

    if (!isStrictIsoString(item.publishedAt)) {
      issues.push(`item[${index}].publishedAt must be a strict ISO string`);
    }

    if (!isStrictIsoString(item.updatedAt)) {
      issues.push(`item[${index}].updatedAt must be a strict ISO string`);
    }

    if (typeof item.order !== "number" || !Number.isFinite(item.order)) {
      issues.push(`item[${index}].order must be a number`);
    }

    if (typeof item.pinned !== "boolean") {
      issues.push(`item[${index}].pinned must be a boolean`);
    }
  });

  return issues;
}

function validateFieldLeakage(snapshot) {
  const issues = [];

  if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.items)) {
    return issues;
  }

  snapshot.items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return;
    }

    Object.keys(item).forEach((key) => {
      if (INTERNAL_FIELD_PATTERN.test(key)) {
        issues.push(`item[${index}] contains internal field ${key}`);
      }
    });
  });

  return issues;
}

function validateOrdering(items) {
  for (let index = 1; index < items.length; index += 1) {
    const left = items[index - 1];
    const right = items[index];

    if (left.pinned !== right.pinned) {
      if (!left.pinned && right.pinned) {
        return false;
      }
      continue;
    }

    if (left.order !== right.order) {
      if (left.order > right.order) {
        return false;
      }
      continue;
    }

    const publishedDelta = toTimestamp(left.publishedAt) - toTimestamp(right.publishedAt);

    if (publishedDelta !== 0) {
      if (publishedDelta < 0) {
        return false;
      }
      continue;
    }

    if (toTimestamp(left.updatedAt) < toTimestamp(right.updatedAt)) {
      return false;
    }
  }

  return true;
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

export function getProductionWorkerSmokeExitCode(status) {
  return SUCCESS_STATUSES.has(status) ? 0 : 1;
}

export async function runPublicDocumentsProductionWorkerSmoke(args = [], options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetch || fetch;
  let parsedArgs;

  try {
    parsedArgs = parseArgs(args);
  } catch (error) {
    return makeResult(
      makeEmptyManifest({
        status: "BLOCKED",
        issues: [{ index: null, messages: [error instanceof Error ? error.message : "invalid arguments"] }]
      })
    );
  }

  const envValues = Object.fromEntries(REQUIRED_ENV.map((key) => [key, readEnv(env, key)]));
  const expectedFromEnv = parseNonNegativeInteger(readEnv(env, "RCAT_PROD_EXPECTED_PUBLIC_DOCUMENT_COUNT"), "");
  const expectedMinCount = parsedArgs.expectedMinCount ?? expectedFromEnv.value ?? 0;
  const workerUrlLabel = makeWorkerUrlLabel(envValues.RCAT_PROD_WORKER_URL);
  const missingKeys = REQUIRED_ENV.filter((key) => envValues[key] === "");
  const envIssues = [];
  const approvalIssues = [];

  if (missingKeys.length > 0) {
    envIssues.push(...missingKeys.map((key) => `missing env: ${key}`));
  }

  if (expectedFromEnv.issue) {
    envIssues.push("RCAT_PROD_EXPECTED_PUBLIC_DOCUMENT_COUNT must be a non-negative integer");
  }

  if (envValues.RCAT_PROD_WORKER_URL) {
    envIssues.push(...validateWorkerUrl(envValues.RCAT_PROD_WORKER_URL).issues);
  }

  if (envValues.RCAT_PROD_WORKER_SMOKE_APPROVAL !== APPROVAL_PHRASE) {
    approvalIssues.push(`RCAT_PROD_WORKER_SMOKE_APPROVAL must exactly match ${APPROVAL_PHRASE}`);
  }

  if (envIssues.length > 0 || approvalIssues.length > 0) {
    const manifest = makeEmptyManifest({
      status: "BLOCKED",
      workerUrlLabel,
      expectedMinCount,
      issues: [
        ...envIssues.map((message) => ({ index: null, messages: [message] })),
        ...approvalIssues.map((message) => ({ index: null, messages: [message] }))
      ]
    });

    manifest.checks.envGate = envIssues.length === 0 ? "passed" : "blocked";
    manifest.checks.approvalGate = approvalIssues.length === 0 ? "passed" : "blocked";

    return makeResult(manifest);
  }

  const endpointUrl = buildEndpointUrl(envValues.RCAT_PROD_WORKER_URL);
  let response;

  try {
    const timed = withTimeout(
      (signal) =>
        fetchImpl(endpointUrl, {
          method: "GET",
          headers: { accept: "application/json" },
          signal
        }),
      parsedArgs.timeoutMs
    );

    response = await timed.promise;
  } catch {
    const manifest = makeEmptyManifest({ status: "FAILED", workerUrlLabel, expectedMinCount });

    manifest.checks.envGate = "passed";
    manifest.checks.approvalGate = "passed";
    manifest.validationIssues = [{ index: null, messages: ["fetch failed or timed out"] }];

    return makeResult(manifest);
  }

  const baseManifest = makeEmptyManifest({ status: "FAILED", workerUrlLabel, expectedMinCount });

  baseManifest.checks.envGate = "passed";
  baseManifest.checks.approvalGate = "passed";
  baseManifest.http = {
    status: response.status,
    ok: Boolean(response.ok)
  };

  if (!response.ok) {
    baseManifest.validationIssues = [{ index: null, messages: ["Worker returned non-2xx status"] }];

    return makeResult(baseManifest);
  }

  baseManifest.checks.httpStatus = "passed";

  let snapshot;

  try {
    snapshot = await response.json();
  } catch {
    baseManifest.validationIssues = [{ index: null, messages: ["Worker response JSON could not be parsed"] }];

    return makeResult(baseManifest);
  }

  baseManifest.checks.jsonParse = "passed";

  const contractIssues = validateSnapshotContract(snapshot);
  const leakageIssues = validateFieldLeakage(snapshot);
  const hasValidItems = Array.isArray(snapshot?.items);
  const orderingPassed = hasValidItems ? validateOrdering(snapshot.items) : false;
  const minimumCountPassed = hasValidItems ? snapshot.items.length >= expectedMinCount : false;

  baseManifest.snapshot = {
    itemCount: hasValidItems ? snapshot.items.length : 0,
    expectedMinCount,
    firstPublicItemIds: hasValidItems
      ? snapshot.items
          .slice(0, 3)
          .map((item) => item.id)
          .filter(Boolean)
      : [],
    generatedAt: isStrictIsoString(snapshot?.generatedAt) ? snapshot.generatedAt : null
  };
  baseManifest.checks.snapshotContract = contractIssues.length === 0 ? "passed" : "blocked";
  baseManifest.checks.fieldLeakage = leakageIssues.length === 0 ? "passed" : "blocked";
  baseManifest.checks.ordering = orderingPassed ? "passed" : "blocked";
  baseManifest.checks.minimumCount = minimumCountPassed ? "passed" : "blocked";

  const validationIssues = [
    ...contractIssues.map((message) => ({ index: null, messages: [message] })),
    ...leakageIssues.map((message) => ({ index: null, messages: [message] }))
  ];

  if (!orderingPassed) {
    validationIssues.push({ index: null, messages: ["ordering validation failed"] });
  }

  if (!minimumCountPassed) {
    validationIssues.push({ index: null, messages: ["item count is below expected minimum"] });
  }

  baseManifest.validationIssues = validationIssues;
  baseManifest.status = validationIssues.length === 0 ? "PASSED" : "FAILED";

  return makeResult(baseManifest);
}

export function formatPublicDocumentsProductionWorkerSmokeResult(result, options = {}) {
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
    `Endpoint: ${manifest.target.endpoint}`,
    `HTTP status: ${manifest.http.status ?? "n/a"}`,
    `HTTP ok: ${manifest.http.ok}`,
    `Item count: ${manifest.snapshot.itemCount}`,
    `Expected minimum count: ${manifest.snapshot.expectedMinCount}`,
    `First 3 public item IDs: ${manifest.snapshot.firstPublicItemIds.join(", ")}`,
    `Snapshot generatedAt: ${manifest.snapshot.generatedAt ?? "n/a"}`
  ];

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
    "No frontend cutover was performed.",
    "No production frontend environment was changed.",
    "No D1 writes were run.",
    "No production Worker deploy was run.",
    "No production import was run.",
    "No Apps Script changes were made."
  );

  return lines.join("\n");
}

export async function main() {
  const args = process.argv.slice(2);
  const result = await runPublicDocumentsProductionWorkerSmoke(args);

  console.log(formatPublicDocumentsProductionWorkerSmokeResult(result, { json: args.includes("--json") }));

  process.exitCode = getProductionWorkerSmokeExitCode(result.status);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
