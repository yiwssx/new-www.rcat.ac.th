/* global console, process */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile as readFileFromDisk, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createPublicDocumentListSnapshotFromImportRows,
  transformPublicDocumentSourceRecords,
  validatePublicDocumentD1ImportRow,
  validatePublicDocumentImportSourceRecord
} from "./public-documents-import-dry-run.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const CHECKPOINT = "M13";
const SCOPE = "public-document-list";
const APPROVAL_PHRASE = "APPROVED_PRODUCTION_D1_IMPORT";
const REQUIRED_EXECUTE_ENV = ["RCAT_PROD_D1_DATABASE_NAME", "RCAT_PROD_D1_DATABASE_ID", "RCAT_PROD_IMPORT_APPROVAL"];
const NON_PROD_NAME_PATTERN = /\b(preview|local|dev|test|staging|sandbox)\b/i;
const PROD_NAME_PATTERN = /(prod|production)/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STRICT_ISO_MESSAGE = "--generated-at must be a strict ISO string";
const SUCCESS_STATUSES = new Set(["READY_DRY_RUN", "IMPORTED"]);
const PUBLIC_ITEM_KEYS = [
  "id",
  "title",
  "description",
  "category",
  "fileUrl",
  "fileName",
  "mediaId",
  "publishedAt",
  "order",
  "pinned",
  "updatedAt"
].sort();
const SAFE_FALSE_FLAGS = {
  frontendCutover: false,
  vercelEnvChanged: false,
  [`${"apps"}${"Script"}Changed`]: false,
  [`${"google"}${"Api"}Changed`]: false,
  uiRoutesCacheChanged: false,
  productionWorkerDeploy: false,
  schemaMigration: false
};

function parseArgs(args) {
  const parsed = {
    inputPath: null,
    execute: false,
    json: false,
    manifest: false,
    generatedAt: null
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--execute") {
      parsed.execute = true;
      continue;
    }

    if (arg === "--json") {
      parsed.json = true;
      continue;
    }

    if (arg === "--manifest") {
      parsed.manifest = true;
      continue;
    }

    if (arg === "--input") {
      const nextArg = args[index + 1];

      if (!nextArg) {
        throw new Error("--input requires a path");
      }

      parsed.inputPath = path.resolve(process.cwd(), nextArg);
      index += 1;
      continue;
    }

    if (arg === "--generated-at") {
      const nextArg = args[index + 1];

      if (!nextArg) {
        throw new Error("--generated-at requires an ISO string");
      }

      parsed.generatedAt = nextArg;
      index += 1;
      continue;
    }

    throw new Error(`unknown argument: ${arg}`);
  }

  return parsed;
}

function isStrictIsoString(value) {
  if (typeof value !== "string") {
    return false;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function toTimestamp(value) {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function makePathLabel(inputPath) {
  return inputPath ? path.basename(inputPath) : "not-provided";
}

function normalizePolicyPath(inputPath) {
  const normalized = path.posix.normalize(String(inputPath).replaceAll("\\", "/"));

  if (normalized === ".") {
    return "";
  }

  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function isPolicyAbsolutePath(inputPath) {
  return inputPath.startsWith("/") || /^[A-Za-z]:\//.test(inputPath);
}

function comparePolicyPath(inputPath, repoRoot) {
  const hasWindowsDrive = /^[A-Za-z]:/.test(inputPath) || /^[A-Za-z]:/.test(repoRoot);

  return hasWindowsDrive ? inputPath.toLowerCase() : inputPath;
}

function resolvePolicyPath(inputPath, repoRoot) {
  const normalizedInput = normalizePolicyPath(inputPath);

  if (isPolicyAbsolutePath(normalizedInput)) {
    return normalizedInput;
  }

  return normalizePolicyPath(`${normalizePolicyPath(repoRoot)}/${normalizedInput}`);
}

function getRepositoryRelativePolicyPath(inputPath, repoRoot) {
  const resolvedInput = resolvePolicyPath(inputPath, repoRoot);
  const normalizedRepoRoot = normalizePolicyPath(repoRoot);
  const comparableInput = comparePolicyPath(resolvedInput, normalizedRepoRoot);
  const comparableRepoRoot = comparePolicyPath(normalizedRepoRoot, normalizedRepoRoot);

  if (comparableInput === comparableRepoRoot) {
    return "";
  }

  if (comparableInput.startsWith(`${comparableRepoRoot}/`)) {
    return resolvedInput.slice(normalizedRepoRoot.length + 1);
  }

  return null;
}

export function isProductionImportInputPathAllowed(inputPath, repoRoot = REPO_ROOT) {
  const normalizedInput = normalizePolicyPath(inputPath);
  const relativePath = getRepositoryRelativePolicyPath(normalizedInput, repoRoot);

  if (relativePath === null) {
    return isPolicyAbsolutePath(normalizedInput);
  }

  return (
    relativePath.startsWith("tmp/") ||
    relativePath.startsWith("temp/") ||
    relativePath.startsWith(".tmp/") ||
    relativePath.startsWith("cloudflare/public-api/tmp/")
  );
}

export function getProductionImportExitCode(status) {
  return SUCCESS_STATUSES.has(status) ? 0 : 1;
}

function isInputPathAllowed(inputPath) {
  if (isProductionImportInputPathAllowed(inputPath)) {
    return true;
  }

  return false;
}

function redactedD1Id(value) {
  if (!value || typeof value !== "string" || value.length < 8) {
    return null;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function makeValidation(status) {
  const value = status === "passed" ? "passed" : "blocked";

  return {
    sourceValidation: value,
    d1RowValidation: value,
    snapshotContract: value,
    ordering: value,
    fieldLeakage: value
  };
}

function makeEmptyManifest({ mode, status, inputPath, inputChecksum = null, validationIssues = [], env = {} }) {
  return {
    checkpoint: CHECKPOINT,
    scope: SCOPE,
    mode,
    status,
    input: {
      pathLabel: makePathLabel(inputPath),
      sha256: inputChecksum,
      sourceRecordCount: 0
    },
    validation: makeValidation("blocked"),
    import: {
      targetDatabaseNameLabel: env.RCAT_PROD_D1_DATABASE_NAME || "not-provided",
      targetDatabaseIdRedacted: redactedD1Id(env.RCAT_PROD_D1_DATABASE_ID),
      rowCount: 0,
      batchCount: 0,
      executedAt: null
    },
    firstPublicItemIds: [],
    safety: { ...SAFE_FALSE_FLAGS },
    validationIssues
  };
}

function makeResult(manifest) {
  return {
    status: manifest.status,
    manifest
  };
}

function countValidationErrors(validationIssues) {
  return validationIssues.reduce((count, issue) => count + issue.messages.length, 0);
}

function validateSnapshotContract(snapshot) {
  if (JSON.stringify(Object.keys(snapshot).sort()) !== JSON.stringify(["generatedAt", "items"])) {
    return false;
  }

  if (!isStrictIsoString(snapshot.generatedAt)) {
    return false;
  }

  if (!Array.isArray(snapshot.items)) {
    return false;
  }

  return snapshot.items.every((item) => JSON.stringify(Object.keys(item).sort()) === JSON.stringify(PUBLIC_ITEM_KEYS));
}

function validateSnapshotOrdering(items) {
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

function validateFieldLeakage(snapshot) {
  const serializedSnapshot = JSON.stringify(snapshot);

  return !/"(?:file_url|file_name|media_id|published_at|sort_order|updated_at|status)"/.test(serializedSnapshot);
}

function validateExecuteEnv(env) {
  const issues = [];

  REQUIRED_EXECUTE_ENV.forEach((key) => {
    if (!env[key]) {
      issues.push({ index: null, messages: [`missing env: ${key}`] });
    }
  });

  const databaseName = env.RCAT_PROD_D1_DATABASE_NAME || "";
  const databaseId = env.RCAT_PROD_D1_DATABASE_ID || "";

  if (env.RCAT_PROD_IMPORT_APPROVAL && env.RCAT_PROD_IMPORT_APPROVAL !== APPROVAL_PHRASE) {
    issues.push({ index: null, messages: [`RCAT_PROD_IMPORT_APPROVAL must exactly match ${APPROVAL_PHRASE}`] });
  }

  if (databaseName && !PROD_NAME_PATTERN.test(databaseName)) {
    issues.push({ index: null, messages: ["D1 database name must clearly include prod or production"] });
  }

  if (databaseName && NON_PROD_NAME_PATTERN.test(databaseName)) {
    issues.push({
      index: null,
      messages: ["D1 database name must not include preview/local/dev/test/staging/sandbox"]
    });
  }

  if (databaseId === "preview-placeholder" || databaseId === "local-placeholder") {
    issues.push({ index: null, messages: ["D1 database id must not be a placeholder"] });
  } else if (databaseId && !UUID_PATTERN.test(databaseId)) {
    issues.push({ index: null, messages: ["D1 database id must be a UUID"] });
  }

  return issues;
}

function parseBatchSize(value) {
  if (!value) {
    return 500;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 500;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNumber(value) {
  return Number.isFinite(value) ? String(value) : "0";
}

function createImportSql(rows) {
  const lines = ["BEGIN TRANSACTION;", "DELETE FROM documents;"];

  rows.forEach((row) => {
    lines.push(
      [
        "INSERT INTO documents",
        "(id, title, description, category, file_url, file_name, media_id, published_at, sort_order, pinned, updated_at, status)",
        "VALUES",
        `(${[
          sqlString(row.id),
          sqlString(row.title),
          sqlString(row.description),
          sqlString(row.category),
          sqlString(row.file_url),
          sqlString(row.file_name),
          sqlString(row.media_id),
          sqlString(row.published_at),
          sqlNumber(row.sort_order),
          sqlNumber(row.pinned),
          sqlString(row.updated_at),
          sqlString(row.status)
        ].join(", ")});`
      ].join(" ")
    );
  });

  lines.push("COMMIT;");

  return `${lines.join("\n")}\n`;
}

async function defaultWriteTempSql(sql) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "rcat-public-documents-import-"));
  const filePath = path.join(tempDir, "public-documents-production-import.sql");

  await writeFile(filePath, sql, "utf8");

  return filePath;
}

async function defaultCleanupTempSql(filePath) {
  await rm(path.dirname(filePath), { recursive: true, force: true });
}

function defaultExecute({ command, args }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore", shell: false });

    child.on("error", () => resolve({ code: 1 }));
    child.on("close", (code) => resolve({ code: code ?? 1 }));
  });
}

async function executeImport({ rows, env, generatedAt, execute, writeTempSql, cleanupTempSql }) {
  const sql = createImportSql(rows);
  const tempSqlPath = await writeTempSql(sql);
  const args = [
    "d1",
    "execute",
    env.RCAT_PROD_D1_DATABASE_NAME,
    "--remote",
    "--file",
    tempSqlPath,
    "--config",
    "cloudflare/public-api/wrangler.toml"
  ];

  try {
    const executionResult = await execute({ command: "wrangler", args });

    if (!executionResult || executionResult.code !== 0) {
      return {
        status: "FAILED",
        executedAt: null,
        validationIssues: [{ index: null, messages: ["wrangler d1 execute failed"] }]
      };
    }

    return { status: "IMPORTED", executedAt: generatedAt.toISOString(), validationIssues: [] };
  } finally {
    await cleanupTempSql(tempSqlPath);
  }
}

export async function runPublicDocumentsProductionImport(args = [], options = {}) {
  const env = options.env || process.env;
  const readFile = options.readFile || readFileFromDisk;
  const execute = options.execute || defaultExecute;
  const writeTempSql = options.writeTempSql || defaultWriteTempSql;
  const cleanupTempSql = options.cleanupTempSql || defaultCleanupTempSql;
  let parsedArgs;

  try {
    parsedArgs = parseArgs(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid arguments";

    return makeResult(
      makeEmptyManifest({
        mode: "dry-run",
        status: "BLOCKED",
        inputPath: null,
        validationIssues: [{ index: null, messages: [message] }],
        env
      })
    );
  }

  const mode = parsedArgs.execute ? "execute" : "dry-run";

  if (!parsedArgs.inputPath) {
    return makeResult(
      makeEmptyManifest({
        mode,
        status: "BLOCKED",
        inputPath: null,
        validationIssues: [{ index: null, messages: ["--input is required"] }],
        env
      })
    );
  }

  if (parsedArgs.generatedAt !== null && !isStrictIsoString(parsedArgs.generatedAt)) {
    return makeResult(
      makeEmptyManifest({
        mode,
        status: "BLOCKED",
        inputPath: parsedArgs.inputPath,
        validationIssues: [{ index: null, messages: [STRICT_ISO_MESSAGE] }],
        env
      })
    );
  }

  if (!isInputPathAllowed(parsedArgs.inputPath)) {
    return makeResult(
      makeEmptyManifest({
        mode,
        status: "BLOCKED",
        inputPath: parsedArgs.inputPath,
        validationIssues: [
          { index: null, messages: ["input path inside repository must be under an ignored temp path"] }
        ],
        env
      })
    );
  }

  let rawInput;

  try {
    rawInput = await readFile(parsedArgs.inputPath, "utf8");
  } catch {
    return makeResult(
      makeEmptyManifest({
        mode,
        status: "BLOCKED",
        inputPath: parsedArgs.inputPath,
        validationIssues: [{ index: null, messages: ["input file could not be read"] }],
        env
      })
    );
  }

  const inputChecksum = sha256(rawInput);
  let records;

  try {
    records = JSON.parse(rawInput);
  } catch {
    return makeResult(
      makeEmptyManifest({
        mode,
        status: "BLOCKED",
        inputPath: parsedArgs.inputPath,
        inputChecksum,
        validationIssues: [{ index: null, messages: ["input must be valid JSON"] }],
        env
      })
    );
  }

  if (!Array.isArray(records)) {
    return makeResult(
      makeEmptyManifest({
        mode,
        status: "BLOCKED",
        inputPath: parsedArgs.inputPath,
        inputChecksum,
        validationIssues: [{ index: null, messages: ["input JSON must be an array"] }],
        env
      })
    );
  }

  const sourceValidationIssues = records
    .map((record, index) => ({ index, messages: validatePublicDocumentImportSourceRecord(record) }))
    .filter((issue) => issue.messages.length > 0);

  if (sourceValidationIssues.length > 0) {
    const manifest = makeEmptyManifest({
      mode,
      status: "BLOCKED",
      inputPath: parsedArgs.inputPath,
      inputChecksum,
      validationIssues: sourceValidationIssues,
      env
    });

    manifest.input.sourceRecordCount = records.length;
    manifest.input.validationErrorCount = countValidationErrors(sourceValidationIssues);

    return makeResult(manifest);
  }

  const rows = transformPublicDocumentSourceRecords(records);
  const d1ValidationIssues = rows
    .map((row, index) => ({ index, messages: validatePublicDocumentD1ImportRow(row) }))
    .filter((issue) => issue.messages.length > 0);

  if (d1ValidationIssues.length > 0) {
    return makeResult(
      makeEmptyManifest({
        mode,
        status: "BLOCKED",
        inputPath: parsedArgs.inputPath,
        inputChecksum,
        validationIssues: d1ValidationIssues,
        env
      })
    );
  }

  const generatedAt = parsedArgs.generatedAt === null ? new Date() : new Date(parsedArgs.generatedAt);
  let snapshot;

  try {
    snapshot = createPublicDocumentListSnapshotFromImportRows(rows, generatedAt);
  } catch (error) {
    return makeResult(
      makeEmptyManifest({
        mode,
        status: "BLOCKED",
        inputPath: parsedArgs.inputPath,
        inputChecksum,
        validationIssues: [
          { index: null, messages: [error instanceof Error ? error.message : "snapshot creation failed"] }
        ],
        env
      })
    );
  }

  const validation = {
    sourceValidation: "passed",
    d1RowValidation: "passed",
    snapshotContract: validateSnapshotContract(snapshot) ? "passed" : "blocked",
    ordering: validateSnapshotOrdering(snapshot.items) ? "passed" : "blocked",
    fieldLeakage: validateFieldLeakage(snapshot) ? "passed" : "blocked"
  };
  const validationIssues = Object.entries(validation)
    .filter(([, value]) => value === "blocked")
    .map(([key]) => ({ index: null, messages: [`${key} blocked`] }));

  if (validationIssues.length > 0) {
    return makeResult(
      makeEmptyManifest({
        mode,
        status: "BLOCKED",
        inputPath: parsedArgs.inputPath,
        inputChecksum,
        validationIssues,
        env
      })
    );
  }

  const batchSize = parseBatchSize(env.RCAT_PROD_IMPORT_BATCH_SIZE);
  const baseManifest = {
    checkpoint: CHECKPOINT,
    scope: SCOPE,
    mode,
    status: parsedArgs.execute ? "BLOCKED" : "READY_DRY_RUN",
    input: {
      pathLabel: makePathLabel(parsedArgs.inputPath),
      sha256: inputChecksum,
      sourceRecordCount: records.length
    },
    validation,
    import: {
      targetDatabaseNameLabel: parsedArgs.execute ? env.RCAT_PROD_D1_DATABASE_NAME || "not-provided" : "not-provided",
      targetDatabaseIdRedacted: parsedArgs.execute ? redactedD1Id(env.RCAT_PROD_D1_DATABASE_ID) : null,
      rowCount: rows.length,
      batchCount: Math.max(1, Math.ceil(rows.length / batchSize)),
      executedAt: null
    },
    firstPublicItemIds: snapshot.items.slice(0, 3).map((item) => item.id),
    safety: { ...SAFE_FALSE_FLAGS },
    validationIssues: []
  };

  if (!parsedArgs.execute) {
    return makeResult(baseManifest);
  }

  const envIssues = validateExecuteEnv(env);

  if (envIssues.length > 0) {
    return makeResult({
      ...baseManifest,
      status: "BLOCKED",
      validationIssues: envIssues
    });
  }

  const executionResult = await executeImport({ rows, env, generatedAt, execute, writeTempSql, cleanupTempSql });

  return makeResult({
    ...baseManifest,
    status: executionResult.status,
    import: {
      ...baseManifest.import,
      executedAt: executionResult.executedAt
    },
    validationIssues: executionResult.validationIssues
  });
}

export function formatPublicDocumentsProductionImportResult(result, options = {}) {
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
    `Input path label: ${manifest.input.pathLabel}`,
    `Input SHA-256: ${manifest.input.sha256 ?? "n/a"}`,
    `Source record count: ${manifest.input.sourceRecordCount}`,
    `Target database: ${manifest.import.targetDatabaseNameLabel}`,
    `Target database id: ${manifest.import.targetDatabaseIdRedacted ?? "n/a"}`,
    `Import row count: ${manifest.import.rowCount}`,
    `Batch count: ${manifest.import.batchCount}`,
    `Executed at: ${manifest.import.executedAt ?? "n/a"}`,
    `First 3 public item IDs: ${manifest.firstPublicItemIds.join(", ")}`
  ];

  if (manifest.validationIssues.length > 0) {
    lines.push("", "Validation issues:");
    manifest.validationIssues.forEach((issue) => {
      const prefix = issue.index === null ? "input" : `record[${issue.index}]`;
      issue.messages.forEach((message) => {
        lines.push(`- ${prefix}: ${message}`);
      });
    });
  }

  lines.push("", "Validation:");
  Object.entries(manifest.validation).forEach(([key, value]) => {
    lines.push(`- ${key}: ${value}`);
  });

  if (manifest.mode === "execute" && manifest.status === "IMPORTED") {
    lines.push("", "D1 writes were executed after approval gates passed.");
  } else {
    lines.push("", "No D1 writes were run.");
  }

  lines.push(
    "No frontend cutover was performed.",
    "No Vercel environment was changed.",
    "No Apps Script changes were made."
  );

  return lines.join("\n");
}

export async function main() {
  const args = process.argv.slice(2);
  const result = await runPublicDocumentsProductionImport(args);

  console.log(
    formatPublicDocumentsProductionImportResult(result, {
      json: args.includes("--json") || args.includes("--manifest")
    })
  );

  process.exitCode = getProductionImportExitCode(result.status);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
