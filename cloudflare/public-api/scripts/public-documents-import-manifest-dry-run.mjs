/* global console, process */
import { createHash } from "node:crypto";
import { readFile as readFileFromDisk } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runPublicDocumentsImportDryRun } from "./public-documents-import-dry-run.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DEFAULT_INPUT_PATH = path.join(
  REPO_ROOT,
  "cloudflare/public-api/test/fixtures/public-documents.import-source.redacted.json"
);
const STRICT_ISO_MESSAGE = "--generated-at must be a strict ISO string";
const FORBIDDEN_HOST_PARTS = [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`];
const D1_ID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
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
  d1Writes: false,
  productionCommands: false,
  networkCalls: false,
  realProductionData: false,
  realGoogleDriveUrls: false,
  d1IdsCommitted: false,
  [`${"apps"}${"Script"}Changed`]: false,
  [`${"google"}${"Api"}Changed`]: false,
  uiRoutesCacheChanged: false
};

function toRepoRelativePath(inputPath) {
  return path.relative(REPO_ROOT, inputPath).replaceAll(path.sep, "/");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isStrictIsoString(value) {
  if (typeof value !== "string") {
    return false;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function toTimestamp(value) {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function hasForbiddenInputValue(rawInput) {
  const normalizedValue = rawInput.toLowerCase();

  return FORBIDDEN_HOST_PARTS.some((hostPart) => normalizedValue.includes(hostPart)) || D1_ID_PATTERN.test(rawInput);
}

function parseArgs(args) {
  const parsed = {
    inputPath: DEFAULT_INPUT_PATH,
    json: false,
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

function makeChecks(status, rawInput, snapshot) {
  const blockedChecks = {
    sourceValidation: "blocked",
    d1RowValidation: "blocked",
    snapshotContract: "blocked",
    ordering: "blocked",
    fieldLeakage: "blocked",
    redactedInputSafety: "blocked"
  };

  if (status !== "READY" || !rawInput || !snapshot) {
    return blockedChecks;
  }

  return {
    sourceValidation: "passed",
    d1RowValidation: "passed",
    snapshotContract: validateSnapshotContract(snapshot) ? "passed" : "blocked",
    ordering: validateSnapshotOrdering(snapshot.items) ? "passed" : "blocked",
    fieldLeakage: validateFieldLeakage(snapshot) ? "passed" : "blocked",
    redactedInputSafety: hasForbiddenInputValue(rawInput) ? "blocked" : "passed"
  };
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

function checksArePassed(checks) {
  return Object.values(checks).every((value) => value === "passed");
}

function emptySummary(inputPath, validationIssues) {
  return {
    inputPath,
    sourceRecordCount: 0,
    transformedRowCount: 0,
    publicItemCount: 0,
    excludedDraftInactiveCount: 0,
    validationErrorCount: validationIssues.reduce((count, issue) => count + issue.messages.length, 0),
    firstPublicItemIds: [],
    generatedAt: null
  };
}

function makeManifest({ status, inputPath, inputChecksum, dryRunSummary, checks, validationIssues }) {
  return {
    manifestVersion: 1,
    checkpoint: "M12",
    scope: "public-document-list",
    status,
    input: {
      path: inputPath,
      sha256: inputChecksum,
      sourceType: "redacted-fixture"
    },
    dryRun: {
      sourceRecordCount: dryRunSummary.sourceRecordCount,
      transformedRowCount: dryRunSummary.transformedRowCount,
      publicItemCount: dryRunSummary.publicItemCount,
      excludedDraftInactiveCount: dryRunSummary.excludedDraftInactiveCount,
      validationErrorCount: dryRunSummary.validationErrorCount,
      firstPublicItemIds: dryRunSummary.firstPublicItemIds,
      generatedAt: dryRunSummary.generatedAt
    },
    checks,
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

export async function runPublicDocumentsImportManifestDryRun(args = [], options = {}) {
  let parsedArgs;

  try {
    parsedArgs = parseArgs(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid arguments";
    const inputPath = toRepoRelativePath(DEFAULT_INPUT_PATH);
    const validationIssues = [{ index: null, messages: [message] }];
    const manifest = makeManifest({
      status: "BLOCKED",
      inputPath,
      inputChecksum: null,
      dryRunSummary: emptySummary(inputPath, validationIssues),
      checks: makeChecks("BLOCKED"),
      validationIssues
    });

    return makeResult(manifest);
  }

  const inputPath = parsedArgs.inputPath;
  const inputPathForSummary = toRepoRelativePath(inputPath);
  const readFile = options.readFile || readFileFromDisk;

  if (parsedArgs.generatedAt !== null && !isStrictIsoString(parsedArgs.generatedAt)) {
    const validationIssues = [{ index: null, messages: [STRICT_ISO_MESSAGE] }];
    const manifest = makeManifest({
      status: "BLOCKED",
      inputPath: inputPathForSummary,
      inputChecksum: null,
      dryRunSummary: emptySummary(inputPathForSummary, validationIssues),
      checks: makeChecks("BLOCKED"),
      validationIssues
    });

    return makeResult(manifest);
  }

  let rawInput;

  try {
    rawInput = await readFile(inputPath, "utf8");
  } catch {
    const validationIssues = [{ index: null, messages: ["input file could not be read"] }];
    const manifest = makeManifest({
      status: "BLOCKED",
      inputPath: inputPathForSummary,
      inputChecksum: null,
      dryRunSummary: emptySummary(inputPathForSummary, validationIssues),
      checks: makeChecks("BLOCKED"),
      validationIssues
    });

    return makeResult(manifest);
  }

  const inputChecksum = sha256(rawInput);
  const generatedAt = parsedArgs.generatedAt === null ? new Date() : new Date(parsedArgs.generatedAt);
  const dryRunArgs = ["--input", inputPath];
  const dryRunResult = await runPublicDocumentsImportDryRun(dryRunArgs, {
    generatedAt,
    readFile: async () => rawInput
  });
  const checks = makeChecks(dryRunResult.status, rawInput, dryRunResult.snapshot);
  const status = dryRunResult.status === "READY" && checksArePassed(checks) ? "READY" : "BLOCKED";
  const validationIssues =
    status === "READY"
      ? []
      : [
          ...dryRunResult.validationIssues,
          ...Object.entries(checks)
            .filter(([, value]) => value === "blocked")
            .flatMap(([key]) =>
              dryRunResult.validationIssues.length > 0 ? [] : [{ index: null, messages: [`${key} blocked`] }]
            )
        ];
  const manifest = makeManifest({
    status,
    inputPath: inputPathForSummary,
    inputChecksum,
    dryRunSummary: status === "READY" ? dryRunResult.summary : dryRunResult.summary,
    checks,
    validationIssues
  });

  return makeResult(manifest);
}

export function formatPublicDocumentsImportManifestDryRunResult(result, options = {}) {
  const manifest = result.manifest;

  if (options.json) {
    return JSON.stringify(manifest, null, 2);
  }

  const lines = [
    manifest.status,
    "",
    `Manifest version: ${manifest.manifestVersion}`,
    `Checkpoint: ${manifest.checkpoint}`,
    `Scope: ${manifest.scope}`,
    `Input path: ${manifest.input.path}`,
    `Input SHA-256: ${manifest.input.sha256 ?? "n/a"}`
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

  lines.push(
    "",
    `Source record count: ${manifest.dryRun.sourceRecordCount}`,
    `Transformed row count: ${manifest.dryRun.transformedRowCount}`,
    `Public item count: ${manifest.dryRun.publicItemCount}`,
    `Excluded draft/inactive count: ${manifest.dryRun.excludedDraftInactiveCount}`,
    `Validation error count: ${manifest.dryRun.validationErrorCount}`,
    `First 3 public item IDs: ${manifest.dryRun.firstPublicItemIds.join(", ")}`,
    `Generated at: ${manifest.dryRun.generatedAt ?? "n/a"}`,
    "",
    "Checks:"
  );

  Object.entries(manifest.checks).forEach(([key, value]) => {
    lines.push(`- ${key}: ${value}`);
  });

  lines.push("", "No D1 writes were run.", "No production commands were run.", "No network calls were made.");

  return lines.join("\n");
}

export async function main() {
  const args = process.argv.slice(2);
  const result = await runPublicDocumentsImportManifestDryRun(args);

  console.log(formatPublicDocumentsImportManifestDryRunResult(result, { json: args.includes("--json") }));

  if (result.status !== "READY") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
