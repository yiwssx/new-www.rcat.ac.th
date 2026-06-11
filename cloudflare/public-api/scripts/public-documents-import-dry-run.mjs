/* global console, process */
import { readFile as readFileFromDisk } from "node:fs/promises";
import path from "node:path";
import { URL, fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DEFAULT_INPUT_PATH = path.join(
  REPO_ROOT,
  "cloudflare/public-api/test/fixtures/public-documents.import-source.redacted.json"
);
const ACTIVE_IMPORT_STATUS = "published";
const ALLOWED_IMPORT_STATUSES = ["published", "draft", "inactive"];
const ALLOWED_STATUS_MESSAGE = "status must be one of: published, draft, inactive";
const FORBIDDEN_HOST_PARTS = [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`];
const D1_ID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const TOKEN_LIKE_QUERY_KEYS = new Set(["token", "key", "secret", "signature", "sig", "auth"]);
const SAFE_DOCUMENT_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"]);
const SOURCE_RECORD_FIELDS = new Set([
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
  "updatedAt",
  "status"
]);
const D1_ROW_FIELDS = new Set([
  "id",
  "title",
  "description",
  "category",
  "file_url",
  "file_name",
  "media_id",
  "published_at",
  "sort_order",
  "pinned",
  "updated_at",
  "status"
]);
const SOURCE_REQUIRED_STRING_FIELDS = [
  "id",
  "title",
  "description",
  "category",
  "fileUrl",
  "fileName",
  "mediaId",
  "publishedAt",
  "updatedAt",
  "status"
];
const D1_REQUIRED_STRING_FIELDS = [
  "id",
  "title",
  "description",
  "category",
  "file_url",
  "file_name",
  "media_id",
  "published_at",
  "updated_at",
  "status"
];
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
];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isStrictIsoString(value) {
  if (typeof value !== "string") {
    return false;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isNonNegativeInteger(value) {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function hasForbiddenUrl(value) {
  const normalizedValue = value.toLowerCase();

  return FORBIDDEN_HOST_PARTS.some((hostPart) => normalizedValue.includes(hostPart));
}

function hasD1IdPattern(value) {
  return D1_ID_PATTERN.test(value);
}

function isAllowedStatus(value) {
  return typeof value === "string" && ALLOWED_IMPORT_STATUSES.includes(value);
}

function isSourcePinnedCompatible(value) {
  return typeof value === "boolean" || value === 0 || value === 1;
}

function normalizePinned(value) {
  return value === true || value === 1 ? 1 : 0;
}

function toTimestamp(value) {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function toRepoRelativePath(inputPath) {
  return path.relative(REPO_ROOT, inputPath).replaceAll(path.sep, "/");
}

function parseArgs(args) {
  const parsed = {
    inputPath: DEFAULT_INPUT_PATH,
    json: false
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

    throw new Error(`unknown argument: ${arg}`);
  }

  return parsed;
}

function validateUnknownFields(record, allowedFields, label) {
  return Object.keys(record)
    .filter((field) => !allowedFields.has(field))
    .map((field) => `unknown ${label} field: ${field}`);
}

function validateRequiredStrings(record, fields) {
  return fields.flatMap((field) => (isNonEmptyString(record[field]) ? [] : [`${field} is required`]));
}

function validateStrictIsoField(record, field) {
  if (!isNonEmptyString(record[field])) {
    return [];
  }

  return isStrictIsoString(record[field]) ? [] : [`${field} must be a valid ISO string`];
}

function validateStatus(record) {
  return isAllowedStatus(record.status) ? [] : [ALLOWED_STATUS_MESSAGE];
}

function validateFileUrlField(record, field) {
  const value = record[field];

  if (!isNonEmptyString(value)) {
    return [];
  }

  const errors = [];

  if (hasForbiddenUrl(value)) {
    errors.push(`${field} contains a forbidden URL`);
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    errors.push(`${field} must be a valid HTTPS URL`);
    return errors;
  }

  if (url.protocol !== "https:") {
    errors.push(`${field} must be a valid HTTPS URL`);
  }

  const hostname = url.hostname.toLowerCase();

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost")) {
    errors.push(`${field} must not use localhost`);
  }

  const hasTokenLikeQuery = Array.from(url.searchParams.keys()).some((key) =>
    TOKEN_LIKE_QUERY_KEYS.has(key.toLowerCase())
  );

  if (hasTokenLikeQuery) {
    errors.push(`${field} must not contain token-like query parameters`);
  }

  return errors;
}

function validateFileNameField(record, field) {
  const value = record[field];

  if (!isNonEmptyString(value)) {
    return [];
  }

  const fileName = value.trim();
  const errors = [];

  if (fileName.includes("..")) {
    errors.push(`${field} must not contain path traversal`);
  }

  if (fileName.includes("/") || fileName.includes("\\")) {
    errors.push(`${field} must not contain path separators`);
  }

  if (fileName.includes("?")) {
    errors.push(`${field} must not contain query strings`);
  }

  const extensionStart = fileName.lastIndexOf(".");
  const extension = extensionStart >= 0 ? fileName.slice(extensionStart).toLowerCase() : "";

  if (!SAFE_DOCUMENT_EXTENSIONS.has(extension)) {
    errors.push(`${field} must use a safe document extension`);
  }

  return errors;
}

function isUrlLike(value) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function validateMediaIdField(record, field) {
  const value = record[field];

  if (!isNonEmptyString(value)) {
    return [];
  }

  const mediaId = value.trim();
  const errors = [];

  if (isUrlLike(mediaId)) {
    errors.push(`${field} must not be URL-like`);
  }

  if (hasForbiddenUrl(mediaId)) {
    errors.push(`${field} contains a forbidden URL`);
  }

  if (hasD1IdPattern(mediaId)) {
    errors.push(`${field} must not contain a D1 id pattern`);
  }

  return errors;
}

export function validatePublicDocumentImportSourceRecord(record) {
  const errors = [];

  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return ["record must be an object"];
  }

  errors.push(...validateUnknownFields(record, SOURCE_RECORD_FIELDS, "source"));
  errors.push(...validateRequiredStrings(record, SOURCE_REQUIRED_STRING_FIELDS));

  if (isNonEmptyString(record.id) && hasD1IdPattern(record.id)) {
    errors.push("id must not contain a D1 id pattern");
  }

  errors.push(...validateStatus(record));
  errors.push(...validateFileUrlField(record, "fileUrl"));
  errors.push(...validateFileNameField(record, "fileName"));
  errors.push(...validateMediaIdField(record, "mediaId"));
  errors.push(...validateStrictIsoField(record, "publishedAt"));
  errors.push(...validateStrictIsoField(record, "updatedAt"));

  if (!isNonNegativeInteger(record.order)) {
    errors.push("order must be a non-negative integer");
  }

  if (!isSourcePinnedCompatible(record.pinned)) {
    errors.push("pinned must be boolean-compatible");
  }

  return errors;
}

export function validatePublicDocumentD1ImportRow(row) {
  const errors = [];

  errors.push(...validateUnknownFields(row, D1_ROW_FIELDS, "D1 row"));
  errors.push(...validateRequiredStrings(row, D1_REQUIRED_STRING_FIELDS));

  if (isNonEmptyString(row.id) && hasD1IdPattern(row.id)) {
    errors.push("id must not contain a D1 id pattern");
  }

  errors.push(...validateStatus(row));
  errors.push(...validateFileUrlField(row, "file_url"));
  errors.push(...validateFileNameField(row, "file_name"));
  errors.push(...validateMediaIdField(row, "media_id"));
  errors.push(...validateStrictIsoField(row, "published_at"));
  errors.push(...validateStrictIsoField(row, "updated_at"));

  if (!isNonNegativeInteger(row.sort_order)) {
    errors.push("sort_order must be a non-negative integer");
  }

  if (row.pinned !== 0 && row.pinned !== 1) {
    errors.push("pinned must be 0 or 1");
  }

  return errors;
}

export function transformPublicDocumentSourceRecord(record) {
  const errors = validatePublicDocumentImportSourceRecord(record);

  if (errors.length > 0) {
    throw new Error(`public document source record invalid: ${errors.join("; ")}`);
  }

  return {
    id: record.id,
    title: record.title,
    description: record.description,
    category: record.category,
    file_url: record.fileUrl,
    file_name: record.fileName,
    media_id: record.mediaId,
    published_at: record.publishedAt,
    status: record.status,
    sort_order: record.order,
    pinned: normalizePinned(record.pinned),
    updated_at: record.updatedAt
  };
}

export function transformPublicDocumentSourceRecords(records) {
  return records.map((record, index) => {
    const errors = validatePublicDocumentImportSourceRecord(record);

    if (errors.length > 0) {
      throw new Error(`record[${index}] invalid: ${errors.join("; ")}`);
    }

    return transformPublicDocumentSourceRecord(record);
  });
}

export function sortPublicDocumentD1ImportRows(rows) {
  return [...rows].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return right.pinned - left.pinned;
    }

    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    const publishedDelta = toTimestamp(right.published_at) - toTimestamp(left.published_at);

    if (publishedDelta !== 0) {
      return publishedDelta;
    }

    return toTimestamp(right.updated_at) - toTimestamp(left.updated_at);
  });
}

function mapDocumentRowToPublicDocumentItem(row) {
  return {
    id: row.id || "",
    title: row.title || "",
    description: row.description || "",
    category: row.category || "",
    fileUrl: row.file_url || "",
    fileName: row.file_name || "",
    mediaId: row.media_id || "",
    publishedAt: row.published_at || "",
    order: Number.isFinite(row.sort_order) ? Math.max(0, Math.floor(row.sort_order)) : 0,
    pinned: row.pinned === 1,
    updatedAt: row.updated_at || ""
  };
}

export function createPublicDocumentListSnapshotFromImportRows(rows, generatedAt = new Date()) {
  rows.forEach((row, index) => {
    const errors = validatePublicDocumentD1ImportRow(row);

    if (errors.length > 0) {
      throw new Error(`row[${index}] invalid: ${errors.join("; ")}`);
    }
  });

  return {
    items: sortPublicDocumentD1ImportRows(rows)
      .filter((row) => row.status === ACTIVE_IMPORT_STATUS)
      .map(mapDocumentRowToPublicDocumentItem),
    generatedAt: generatedAt.toISOString()
  };
}

function validateSnapshotContract(snapshot) {
  const errors = [];
  const topLevelKeys = Object.keys(snapshot).sort();

  if (JSON.stringify(topLevelKeys) !== JSON.stringify(["generatedAt", "items"])) {
    errors.push("snapshot top-level keys must be only generatedAt and items");
  }

  if (!isStrictIsoString(snapshot.generatedAt)) {
    errors.push("snapshot generatedAt must be a valid ISO string");
  }

  if (!Array.isArray(snapshot.items)) {
    errors.push("snapshot items must be an array");
    return errors;
  }

  const publicKeySignature = JSON.stringify([...PUBLIC_ITEM_KEYS].sort());

  snapshot.items.forEach((item, index) => {
    if (JSON.stringify(Object.keys(item).sort()) !== publicKeySignature) {
      errors.push(`snapshot item[${index}] has invalid public keys`);
    }
  });

  return errors;
}

function validateSnapshotOrdering(items) {
  const errors = [];

  for (let index = 1; index < items.length; index += 1) {
    const left = items[index - 1];
    const right = items[index];

    if (left.pinned !== right.pinned) {
      if (!left.pinned && right.pinned) {
        errors.push("snapshot ordering must keep pinned items first");
      }
      continue;
    }

    if (left.order !== right.order) {
      if (left.order > right.order) {
        errors.push("snapshot ordering must keep order ascending");
      }
      continue;
    }

    const publishedDelta = toTimestamp(left.publishedAt) - toTimestamp(right.publishedAt);

    if (publishedDelta !== 0) {
      if (publishedDelta < 0) {
        errors.push("snapshot ordering must keep publishedAt descending");
      }
      continue;
    }

    if (toTimestamp(left.updatedAt) < toTimestamp(right.updatedAt)) {
      errors.push("snapshot ordering must keep updatedAt descending");
    }
  }

  return errors;
}

function makeBlockedResult(inputPath, validationIssues) {
  return {
    status: "BLOCKED",
    summary: {
      inputPath,
      sourceRecordCount: 0,
      transformedRowCount: 0,
      publicItemCount: 0,
      excludedDraftInactiveCount: 0,
      validationErrorCount: validationIssues.reduce((count, issue) => count + issue.messages.length, 0),
      firstPublicItemIds: [],
      generatedAt: null
    },
    validationIssues,
    snapshot: {
      items: [],
      generatedAt: null
    }
  };
}

export async function runPublicDocumentsImportDryRun(args = [], options = {}) {
  const parsedArgs = parseArgs(args);
  const inputPath = parsedArgs.inputPath;
  const inputPathForSummary = toRepoRelativePath(inputPath);
  const readFile = options.readFile || readFileFromDisk;
  let rawInput;

  try {
    rawInput = await readFile(inputPath, "utf8");
  } catch {
    return makeBlockedResult(inputPathForSummary, [{ index: null, messages: ["input file could not be read"] }]);
  }

  let records;

  try {
    records = JSON.parse(rawInput);
  } catch {
    return makeBlockedResult(inputPathForSummary, [{ index: null, messages: ["input must be valid JSON"] }]);
  }

  if (!Array.isArray(records)) {
    return makeBlockedResult(inputPathForSummary, [{ index: null, messages: ["input JSON must be an array"] }]);
  }

  const sourceValidationIssues = records
    .map((record, index) => ({ index, messages: validatePublicDocumentImportSourceRecord(record) }))
    .filter((issue) => issue.messages.length > 0);

  if (sourceValidationIssues.length > 0) {
    return makeBlockedResult(inputPathForSummary, sourceValidationIssues);
  }

  const rows = transformPublicDocumentSourceRecords(records);
  const d1ValidationIssues = rows
    .map((row, index) => ({ index, messages: validatePublicDocumentD1ImportRow(row) }))
    .filter((issue) => issue.messages.length > 0);

  if (d1ValidationIssues.length > 0) {
    return makeBlockedResult(inputPathForSummary, d1ValidationIssues);
  }

  let snapshot;

  try {
    snapshot = createPublicDocumentListSnapshotFromImportRows(rows);
  } catch (error) {
    return makeBlockedResult(inputPathForSummary, [
      { index: null, messages: [error instanceof Error ? error.message : "snapshot creation failed"] }
    ]);
  }

  const snapshotIssues = [...validateSnapshotContract(snapshot), ...validateSnapshotOrdering(snapshot.items)].map(
    (message) => ({ index: null, messages: [message] })
  );

  if (snapshotIssues.length > 0) {
    return makeBlockedResult(inputPathForSummary, snapshotIssues);
  }

  return {
    status: "READY",
    summary: {
      inputPath: inputPathForSummary,
      sourceRecordCount: records.length,
      transformedRowCount: rows.length,
      publicItemCount: snapshot.items.length,
      excludedDraftInactiveCount: rows.length - snapshot.items.length,
      validationErrorCount: 0,
      firstPublicItemIds: snapshot.items.slice(0, 3).map((item) => item.id),
      generatedAt: snapshot.generatedAt
    },
    validationIssues: [],
    snapshot
  };
}

export function formatPublicDocumentsImportDryRunResult(result, options = {}) {
  if (options.json) {
    return JSON.stringify(
      {
        status: result.status,
        summary: result.summary,
        validationIssues: result.validationIssues
      },
      null,
      2
    );
  }

  const lines = [result.status, "", `Input path: ${result.summary.inputPath}`];

  if (result.validationIssues.length > 0) {
    lines.push("", "Validation issues:");
    result.validationIssues.forEach((issue) => {
      const prefix = issue.index === null ? "input" : `record[${issue.index}]`;
      issue.messages.forEach((message) => {
        lines.push(`- ${prefix}: ${message}`);
      });
    });
  }

  lines.push(
    "",
    `Source record count: ${result.summary.sourceRecordCount}`,
    `Transformed row count: ${result.summary.transformedRowCount}`,
    `Public item count: ${result.summary.publicItemCount}`,
    `Excluded draft/inactive count: ${result.summary.excludedDraftInactiveCount}`,
    `Validation error count: ${result.summary.validationErrorCount}`,
    `First 3 public item IDs: ${result.summary.firstPublicItemIds.join(", ")}`,
    `Generated at: ${result.summary.generatedAt ?? "n/a"}`,
    "",
    "No D1 writes were run.",
    "No production commands were run.",
    "No network calls were made."
  );

  return lines.join("\n");
}

export async function main() {
  const parsedArgs = parseArgs(process.argv.slice(2));
  const result = await runPublicDocumentsImportDryRun(process.argv.slice(2));

  console.log(formatPublicDocumentsImportDryRunResult(result, { json: parsedArgs.json }));

  if (result.status !== "READY") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
