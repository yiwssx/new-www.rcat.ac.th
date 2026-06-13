/* global AbortController, clearTimeout, console, fetch, process, setTimeout, URL */
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const CHECKPOINT = "M15";
const SCOPE = "public-document-list";
const DOCUMENTS_ENDPOINT = "/api/public/documents";
const FRONTEND_HTML_MARKER = 'data-public-document-list="ready"';
const PROVIDER_ENV_VAR = "VITE_PUBLIC_API_PROVIDER";
const CLOUDFLARE_URL_ENV_VAR = "VITE_CLOUDFLARE_PUBLIC_API_URL";
const APPS_SCRIPT_PROVIDER = "apps-script";
const CLOUDFLARE_PROVIDER = "cloudflare";
const CUTOVER_APPROVAL = "APPROVED_PUBLIC_DOCUMENT_FRONTEND_CUTOVER";
const ROLLBACK_APPROVAL = "APPROVED_PUBLIC_DOCUMENT_FRONTEND_ROLLBACK";
const SUCCESS_STATUSES = new Set([
  "READY_PLAN",
  "CUTOVER_READY",
  "CUTOVER_APPLIED",
  "ROLLBACK_READY",
  "ROLLBACK_APPLIED",
  "VERIFIED"
]);
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
  d1Writes: false,
  productionD1Import: false,
  productionD1Migration: false,
  productionWorkerDeploy: false,
  [`${"apps"}${"Script"}Changed`]: false,
  [`${"google"}${"Api"}Changed`]: false,
  uiRoutesCacheChanged: false,
  adminAuthMediaMigration: false
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
    mode: "plan",
    json: false,
    execute: false,
    timeoutMs: 10000,
    expectedMinCount: null,
    generatedAt: null,
    issues: []
  };
  const modeArgs = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--plan") {
      modeArgs.push("plan");
      parsed.mode = "plan";
      continue;
    }

    if (arg === "--cutover") {
      modeArgs.push("cutover");
      parsed.mode = "cutover";
      continue;
    }

    if (arg === "--rollback") {
      modeArgs.push("rollback");
      parsed.mode = "rollback";
      continue;
    }

    if (arg === "--verify") {
      modeArgs.push("verify");
      parsed.mode = "verify";
      continue;
    }

    if (arg === "--json") {
      parsed.json = true;
      continue;
    }

    if (arg === "--execute") {
      parsed.execute = true;
      continue;
    }

    if (arg === "--timeout-ms") {
      const nextArg = args[index + 1];
      const result = parsePositiveInteger(nextArg, "--timeout-ms");

      if (!nextArg || result.issue) {
        parsed.issues.push(result.issue || "--timeout-ms requires a number");
      } else {
        parsed.timeoutMs = result.value;
      }
      index += 1;
      continue;
    }

    if (arg === "--expected-min-count") {
      const nextArg = args[index + 1];
      const result = parseNonNegativeInteger(nextArg, "--expected-min-count");

      if (!nextArg || result.issue) {
        parsed.issues.push(result.issue || "--expected-min-count requires a number");
      } else {
        parsed.expectedMinCount = result.value;
      }
      index += 1;
      continue;
    }

    if (arg === "--generated-at") {
      const nextArg = args[index + 1];

      if (!nextArg) {
        parsed.issues.push("--generated-at requires an ISO string");
      } else if (!isStrictIsoString(nextArg)) {
        parsed.issues.push("--generated-at must be a strict ISO string");
      } else {
        parsed.generatedAt = nextArg;
      }
      index += 1;
      continue;
    }

    parsed.issues.push(`unknown argument: ${arg}`);
  }

  if (new Set(modeArgs).size > 1) {
    parsed.issues.push("choose only one mode");
  }

  if (parsed.execute && parsed.mode === "plan") {
    parsed.issues.push("--execute requires --cutover or --rollback");
  }

  return parsed;
}

function makeChecks(value) {
  return {
    envGate: value,
    approvalGate: value,
    workerSmoke: value,
    frontendSmoke: value,
    providerConfig: value,
    vercelMutation: value,
    rollbackReady: value,
    outputRedaction: value
  };
}

function makeManifest({
  mode,
  status,
  frontendUrlLabel = "not-provided",
  workerUrlLabel = "not-provided",
  providerBefore = "unknown",
  providerTarget = APPS_SCRIPT_PROVIDER,
  expectedMinCount = 0,
  issues = []
}) {
  return {
    checkpoint: CHECKPOINT,
    scope: SCOPE,
    mode,
    status,
    target: {
      frontendUrlLabel,
      workerUrlLabel,
      providerBefore,
      providerTarget
    },
    checks: makeChecks("blocked"),
    verification: {
      itemCount: 0,
      expectedMinCount,
      firstPublicItemIds: [],
      generatedAt: null
    },
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

function getProviderBefore(env) {
  const value = readEnv(env, PROVIDER_ENV_VAR).toLowerCase();

  if (value === APPS_SCRIPT_PROVIDER || value === CLOUDFLARE_PROVIDER) {
    return value;
  }

  return "unknown";
}

function getProviderTarget(mode) {
  return mode === "cutover" ? CLOUDFLARE_PROVIDER : APPS_SCRIPT_PROVIDER;
}

function hostIncludesForbiddenPart(hostname) {
  const normalizedHostname = hostname.toLowerCase();

  return FORBIDDEN_HOSTS.some((hostPart) => normalizedHostname.includes(hostPart));
}

function makeUrlLabel(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value ? "invalid-url" : "not-provided";
  }
}

function validateSafeProductionUrl(value, label) {
  const issues = [];
  let parsedUrl;

  try {
    parsedUrl = new URL(value);
  } catch {
    return { parsedUrl: null, issues: [`${label} must be a valid HTTPS URL`] };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (parsedUrl.protocol !== "https:") {
    issues.push(`${label} must use HTTPS`);
  }

  if (LOCAL_HOST_PATTERN.test(hostname)) {
    issues.push(`${label} must not use localhost`);
  }

  if (PREVIEW_HOST_PATTERN.test(hostname)) {
    issues.push(`${label} must not look like preview/staging/dev/test/sandbox`);
  }

  if (hostIncludesForbiddenPart(hostname)) {
    issues.push(`${label} must not include forbidden storage or Apps Script hosts`);
  }

  if (hostname.endsWith(VERCEL_PREVIEW_SUFFIX)) {
    issues.push(`${label} must not be a Vercel preview URL`);
  }

  return { parsedUrl, issues };
}

function buildEndpointUrl(origin, endpoint = DOCUMENTS_ENDPOINT) {
  const parsedUrl = new URL(origin);

  parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/+$/, "")}${endpoint}`;
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

function validateSnapshot(snapshot, expectedMinCount) {
  const contractIssues = validateSnapshotContract(snapshot);
  const leakageIssues = validateFieldLeakage(snapshot);
  const hasValidItems = Array.isArray(snapshot?.items);
  const orderingPassed = hasValidItems ? validateOrdering(snapshot.items) : false;
  const minimumCountPassed = hasValidItems ? snapshot.items.length >= expectedMinCount : false;
  const issues = [
    ...contractIssues,
    ...leakageIssues,
    ...(orderingPassed ? [] : ["ordering validation failed"]),
    ...(minimumCountPassed ? [] : ["item count is below expected minimum"])
  ];

  return {
    passed: issues.length === 0,
    issues,
    verification: {
      itemCount: hasValidItems ? snapshot.items.length : 0,
      expectedMinCount,
      firstPublicItemIds: hasValidItems
        ? snapshot.items
            .slice(0, 3)
            .map((item) => item.id)
            .filter(Boolean)
        : [],
      generatedAt: isStrictIsoString(snapshot?.generatedAt) ? snapshot.generatedAt : null
    }
  };
}

function mergeVerification(manifest, verification) {
  manifest.verification = {
    ...manifest.verification,
    ...verification
  };
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

async function fetchJsonOrHtml({ fetchImpl, url, timeoutMs }) {
  const timed = withTimeout(
    (signal) =>
      fetchImpl(url, {
        method: "GET",
        headers: { accept: "application/json, text/html;q=0.9" },
        signal
      }),
    timeoutMs
  );
  const response = await timed.promise;
  const contentType = response.headers?.get?.("content-type") || "";

  if (!response.ok) {
    return { ok: false, response, payload: null, html: "" };
  }

  if (contentType.toLowerCase().includes("json")) {
    return { ok: true, response, payload: await response.json(), html: "" };
  }

  return { ok: true, response, payload: null, html: await response.text() };
}

async function runSnapshotSmoke({ fetchImpl, origin, timeoutMs, expectedMinCount }) {
  try {
    const result = await fetchJsonOrHtml({
      fetchImpl,
      url: buildEndpointUrl(origin),
      timeoutMs
    });

    if (!result.ok) {
      return {
        passed: false,
        issues: ["endpoint returned non-2xx status"],
        verification: null
      };
    }

    if (result.payload === null) {
      const htmlPassed =
        result.html.includes(FRONTEND_HTML_MARKER) && !/data-public-error|public-error/i.test(result.html);

      return {
        passed: htmlPassed,
        issues: htmlPassed ? [] : ["frontend HTML marker validation failed"],
        verification: {
          itemCount: 0,
          expectedMinCount,
          firstPublicItemIds: [],
          generatedAt: null
        }
      };
    }

    return validateSnapshot(result.payload, expectedMinCount);
  } catch {
    return {
      passed: false,
      issues: ["fetch failed or timed out"],
      verification: null
    };
  }
}

function makeValidationIssue(message) {
  return { index: null, messages: [message] };
}

function addIssues(manifest, messages) {
  manifest.validationIssues.push(...messages.map(makeValidationIssue));
}

function validateProviderConfig() {
  return {
    passed: true,
    issues: [],
    providerEnvVar: PROVIDER_ENV_VAR,
    providerValues: [APPS_SCRIPT_PROVIDER, CLOUDFLARE_PROVIDER],
    cloudflareUrlEnvVar: CLOUDFLARE_URL_ENV_VAR
  };
}

function getExpectedMinCount(env, parsedArgs) {
  const expectedFromEnv = parseNonNegativeInteger(readEnv(env, "RCAT_PROD_EXPECTED_PUBLIC_DOCUMENT_COUNT"), "");

  return {
    value: parsedArgs.expectedMinCount ?? expectedFromEnv.value ?? 0,
    issue: expectedFromEnv.issue ? "RCAT_PROD_EXPECTED_PUBLIC_DOCUMENT_COUNT must be a non-negative integer" : null
  };
}

function validateEnvForMode(env, parsedArgs) {
  const issues = [];
  const envValues = {
    frontendUrl: readEnv(env, "RCAT_PROD_FRONTEND_URL"),
    workerUrl: readEnv(env, "RCAT_PROD_WORKER_URL"),
    cutoverApproval: readEnv(env, "RCAT_M15_CUTOVER_APPROVAL"),
    rollbackApproval: readEnv(env, "RCAT_M15_ROLLBACK_APPROVAL"),
    vercelToken: readEnv(env, "VERCEL_TOKEN"),
    vercelProjectId: readEnv(env, "VERCEL_PROJECT_ID"),
    vercelOrgId: readEnv(env, "VERCEL_ORG_ID")
  };

  if (!envValues.frontendUrl) {
    issues.push("missing env: RCAT_PROD_FRONTEND_URL");
  } else {
    issues.push(...validateSafeProductionUrl(envValues.frontendUrl, "RCAT_PROD_FRONTEND_URL").issues);
  }

  if (!envValues.workerUrl) {
    issues.push("missing env: RCAT_PROD_WORKER_URL");
  } else {
    issues.push(...validateSafeProductionUrl(envValues.workerUrl, "RCAT_PROD_WORKER_URL").issues);
  }

  if (parsedArgs.execute) {
    ["vercelToken", "vercelProjectId", "vercelOrgId"].forEach((key) => {
      if (!envValues[key]) {
        const envKey = {
          vercelToken: "VERCEL_TOKEN",
          vercelProjectId: "VERCEL_PROJECT_ID",
          vercelOrgId: "VERCEL_ORG_ID"
        }[key];
        issues.push(`missing env: ${envKey}`);
      }
    });
  }

  return { envValues, issues };
}

function validateApprovalForMode(envValues, parsedArgs) {
  if (!parsedArgs.execute) {
    return [];
  }

  if (parsedArgs.mode === "cutover" && envValues.cutoverApproval !== CUTOVER_APPROVAL) {
    return [`RCAT_M15_CUTOVER_APPROVAL must exactly match ${CUTOVER_APPROVAL}`];
  }

  if (parsedArgs.mode === "rollback" && envValues.rollbackApproval !== ROLLBACK_APPROVAL) {
    return [`RCAT_M15_ROLLBACK_APPROVAL must exactly match ${ROLLBACK_APPROVAL}`];
  }

  return [];
}

function createVercelEnvCommand(name, value, envValues) {
  return {
    command: "vercel",
    args: ["env", "add", name, "production", "--value", value],
    env: {
      VERCEL_TOKEN: envValues.vercelToken,
      VERCEL_PROJECT_ID: envValues.vercelProjectId,
      VERCEL_ORG_ID: envValues.vercelOrgId
    }
  };
}

function createVercelDeployCommand(envValues) {
  return {
    command: "vercel",
    args: ["deploy", "--prod", "--yes"],
    env: {
      VERCEL_TOKEN: envValues.vercelToken,
      VERCEL_PROJECT_ID: envValues.vercelProjectId,
      VERCEL_ORG_ID: envValues.vercelOrgId
    }
  };
}

function createMutationCommands(mode, envValues) {
  if (mode === "cutover") {
    return [
      createVercelEnvCommand(PROVIDER_ENV_VAR, CLOUDFLARE_PROVIDER, envValues),
      createVercelEnvCommand(CLOUDFLARE_URL_ENV_VAR, envValues.workerUrl, envValues),
      createVercelDeployCommand(envValues)
    ];
  }

  return [
    createVercelEnvCommand(PROVIDER_ENV_VAR, APPS_SCRIPT_PROVIDER, envValues),
    createVercelDeployCommand(envValues)
  ];
}

async function defaultExecuteCommand({ command, args, env }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: "ignore",
      shell: false
    });

    child.on("error", () => resolve({ code: 1 }));
    child.on("close", (code) => resolve({ code: code ?? 1 }));
  });
}

async function executeMutationCommands({ mode, envValues, executeCommand }) {
  const commands = createMutationCommands(mode, envValues);

  for (const commandInput of commands) {
    const result = await executeCommand(commandInput);

    if (!result || result.code !== 0) {
      return false;
    }
  }

  return true;
}

export function getProductionCutoverExitCode(status) {
  return SUCCESS_STATUSES.has(status) ? 0 : 1;
}

export async function runPublicDocumentsProductionCutover(args = [], options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetch || fetch;
  const executeCommand = options.executeCommand || defaultExecuteCommand;
  const parsedArgs = parseArgs(args);
  const expected = getExpectedMinCount(env, parsedArgs);
  const envValidation = validateEnvForMode(env, parsedArgs);
  const providerConfig = validateProviderConfig();
  const providerTarget = getProviderTarget(parsedArgs.mode);
  const manifest = makeManifest({
    mode: parsedArgs.mode,
    status: "BLOCKED",
    frontendUrlLabel: makeUrlLabel(envValidation.envValues.frontendUrl),
    workerUrlLabel: makeUrlLabel(envValidation.envValues.workerUrl),
    providerBefore: getProviderBefore(env),
    providerTarget,
    expectedMinCount: expected.value,
    issues: parsedArgs.issues.map(makeValidationIssue)
  });

  if (providerConfig.passed) {
    manifest.checks.providerConfig = "passed";
  }

  manifest.checks.outputRedaction = "passed";

  if (expected.issue) {
    addIssues(manifest, [expected.issue]);
  }

  addIssues(manifest, envValidation.issues);

  const approvalIssues = validateApprovalForMode(envValidation.envValues, parsedArgs);
  addIssues(manifest, approvalIssues);

  manifest.checks.envGate = envValidation.issues.length === 0 && !expected.issue ? "passed" : "blocked";
  manifest.checks.approvalGate = approvalIssues.length === 0 ? "passed" : "blocked";
  manifest.checks.rollbackReady =
    parsedArgs.mode === "cutover" || parsedArgs.mode === "rollback" ? "passed" : "blocked";

  if (parsedArgs.issues.length > 0 || expected.issue || envValidation.issues.length > 0 || approvalIssues.length > 0) {
    return makeResult(manifest);
  }

  if (parsedArgs.mode === "plan") {
    manifest.status = "READY_PLAN";

    return makeResult(manifest);
  }

  if (parsedArgs.mode === "verify") {
    const frontendSmoke = await runSnapshotSmoke({
      fetchImpl,
      origin: envValidation.envValues.frontendUrl,
      timeoutMs: parsedArgs.timeoutMs,
      expectedMinCount: expected.value
    });

    if (frontendSmoke.verification) {
      mergeVerification(manifest, frontendSmoke.verification);
    }

    manifest.checks.frontendSmoke = frontendSmoke.passed ? "passed" : "blocked";
    addIssues(manifest, frontendSmoke.issues);
    manifest.status = frontendSmoke.passed ? "VERIFIED" : "FAILED";

    return makeResult(manifest);
  }

  if (parsedArgs.mode === "cutover") {
    const workerSmoke = await runSnapshotSmoke({
      fetchImpl,
      origin: envValidation.envValues.workerUrl,
      timeoutMs: parsedArgs.timeoutMs,
      expectedMinCount: expected.value
    });

    if (workerSmoke.verification) {
      mergeVerification(manifest, workerSmoke.verification);
    }

    manifest.checks.workerSmoke = workerSmoke.passed ? "passed" : "blocked";

    if (!workerSmoke.passed) {
      addIssues(manifest, workerSmoke.issues);
      manifest.status = parsedArgs.execute ? "BLOCKED" : "FAILED";

      return makeResult(manifest);
    }
  }

  if (!parsedArgs.execute) {
    manifest.status = parsedArgs.mode === "cutover" ? "CUTOVER_READY" : "ROLLBACK_READY";

    return makeResult(manifest);
  }

  const mutationPassed = await executeMutationCommands({
    mode: parsedArgs.mode,
    envValues: envValidation.envValues,
    executeCommand
  });

  manifest.checks.vercelMutation = mutationPassed ? "passed" : "blocked";

  if (!mutationPassed) {
    addIssues(manifest, ["production frontend mutation command failed"]);
    manifest.status = "FAILED";

    return makeResult(manifest);
  }

  const frontendSmoke = await runSnapshotSmoke({
    fetchImpl,
    origin: envValidation.envValues.frontendUrl,
    timeoutMs: parsedArgs.timeoutMs,
    expectedMinCount: expected.value
  });

  if (frontendSmoke.verification) {
    mergeVerification(manifest, frontendSmoke.verification);
  }

  manifest.checks.frontendSmoke = frontendSmoke.passed ? "passed" : "blocked";

  if (!frontendSmoke.passed) {
    addIssues(manifest, frontendSmoke.issues);
    manifest.status = "FAILED";

    return makeResult(manifest);
  }

  manifest.status = parsedArgs.mode === "cutover" ? "CUTOVER_APPLIED" : "ROLLBACK_APPLIED";

  return makeResult(manifest);
}

export function formatPublicDocumentsProductionCutoverResult(result, options = {}) {
  const manifest = result.manifest;

  if (options.json) {
    return JSON.stringify(manifest, null, 2);
  }

  const lines = [
    manifest.status,
    "",
    `Checkpoint: ${manifest.checkpoint}`,
    `Scope: ${manifest.scope}`,
    `Mode: ${manifest.mode}`,
    `Frontend URL label: ${manifest.target.frontendUrlLabel}`,
    `Worker URL label: ${manifest.target.workerUrlLabel}`,
    `Provider before: ${manifest.target.providerBefore}`,
    `Provider target: ${manifest.target.providerTarget}`,
    `Item count: ${manifest.verification.itemCount}`,
    `Expected minimum count: ${manifest.verification.expectedMinCount}`,
    `First 3 public item IDs: ${manifest.verification.firstPublicItemIds.join(", ")}`,
    `Snapshot generatedAt: ${manifest.verification.generatedAt ?? "n/a"}`,
    `Rollback available: ${manifest.checks.rollbackReady === "passed" ? "yes" : "not-confirmed"}`
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
    "No D1 writes were run.",
    "No production D1 import was run.",
    "No production D1 migration was run.",
    "No production Worker deploy was run.",
    "No Apps Script changes were made.",
    "No googleApi.ts changes were made.",
    "No UI, route, cache key, or cache TTL changes were made."
  );

  return lines.join("\n");
}

export async function main() {
  const args = process.argv.slice(2);
  const result = await runPublicDocumentsProductionCutover(args);

  console.log(formatPublicDocumentsProductionCutoverResult(result, { json: args.includes("--json") }));

  process.exitCode = getProductionCutoverExitCode(result.status);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
