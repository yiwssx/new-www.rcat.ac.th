import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  classifyFacebookContent,
  getFacebookSourceText,
  sanitizeFacebookPostId
} from "./facebook-content-classifier.mjs";

const DEFAULT_OUTPUT_DIR = "artifacts/facebook-reclassification";
const DEFAULT_BATCH_SIZE = 100;
const REPAIR_ACTOR = "facebook-metadata-reclassifier";

function parseArgs(argv) {
  const result = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) throw new Error(`Unknown positional argument: ${arg}`);

    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);

    result[key] = value;
    index += 1;
  }

  return result;
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function positiveInteger(value, fallback, label) {
  if (value === undefined || value === null || value === "") return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export function flattenWranglerRows(payload) {
  const statements = Array.isArray(payload) ? payload : [payload];
  const rows = [];

  for (const statement of statements) {
    if (Array.isArray(statement?.results)) rows.push(...statement.results);
    else if (Array.isArray(statement?.result?.results)) rows.push(...statement.result.results);
  }

  return rows;
}

export function isFacebookImportRow(row) {
  const id = String(row?.id ?? "");
  const slug = String(row?.slug ?? "");
  const template = String(row?.template ?? "");
  const owner = String(row?.owner ?? "");
  const createdBy = String(row?.created_by ?? "");

  return (
    template === "facebook-embed" &&
    (id.startsWith("facebook-post-") || slug.startsWith("facebook-")) &&
    (owner === "facebook-import" || createdBy === "facebook-import")
  );
}

function normalizePermalink(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^(?:www\.|m\.|mbasic\.)/u, "");
    const storyId = url.searchParams.get("story_fbid") || url.searchParams.get("fbid");
    const pageId = url.searchParams.get("id");

    if (host === "facebook.com" && storyId && pageId) return `facebook:${pageId}:${storyId}`;

    const pathMatch = url.pathname.match(/\/(\d+)\/posts\/(\d+)/u);
    if (host === "facebook.com" && pathMatch) return `facebook:${pathMatch[1]}:${pathMatch[2]}`;

    return `${host}${url.pathname.replace(/\/+$/u, "")}`.toLowerCase();
  } catch {
    return raw
      .replace(/[?#].*$/u, "")
      .replace(/\/+$/u, "")
      .toLowerCase();
  }
}

function sourceKeyFromContentRow(row) {
  const id = String(row?.id ?? "");
  if (id.startsWith("facebook-post-")) return id.slice("facebook-post-".length);

  const slug = String(row?.slug ?? "");
  if (slug.startsWith("facebook-")) return slug.slice("facebook-".length);

  return "";
}

function parseTagsJson(value) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function stableTagsJson(tags) {
  return JSON.stringify(tags);
}

function sameTags(currentJson, proposedTags) {
  return stableTagsJson(parseTagsJson(currentJson)) === stableTagsJson(proposedTags);
}

function buildFacebookIndexes(rawExport) {
  const byId = new Map();
  const byUrl = new Map();

  for (const post of Array.isArray(rawExport?.posts) ? rawExport.posts : []) {
    const idKey = sanitizeFacebookPostId(post?.id);
    if (idKey && !byId.has(idKey)) byId.set(idKey, post);

    const urlKey = normalizePermalink(post?.permalink_url);
    if (urlKey && !byUrl.has(urlKey)) byUrl.set(urlKey, post);
  }

  return { byId, byUrl };
}

function matchFacebookPost(row, indexes) {
  const sourceKey = sourceKeyFromContentRow(row);
  if (sourceKey && indexes.byId.has(sourceKey)) {
    return { post: indexes.byId.get(sourceKey), matchStatus: "matched-id" };
  }

  const urlKey = normalizePermalink(row?.canonical_url);
  if (urlKey && indexes.byUrl.has(urlKey)) {
    return { post: indexes.byUrl.get(urlKey), matchStatus: "matched-url" };
  }

  return { post: null, matchStatus: "unmatched" };
}

function toIsoTimestamp(value) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function buildReportRow(row, indexes) {
  const match = matchFacebookPost(row, indexes);
  const facebookSourceText = getFacebookSourceText(match.post);
  const d1FallbackText = [row?.title, row?.summary]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join("\n");
  const sourceText = facebookSourceText || d1FallbackText;
  const sourceKind = facebookSourceText ? "facebook" : d1FallbackText ? "d1-fallback" : "none";
  const currentCategory = String(row.category ?? "").trim();
  const currentTags = parseTagsJson(row.tags_json);
  const base = {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    sourceId: String(match.post?.id ?? ""),
    title: String(row.title ?? ""),
    canonicalUrl: String(row.canonical_url ?? ""),
    publishAt: toIsoTimestamp(row.publish_at) || String(row.publish_at ?? ""),
    revision: Number.isInteger(Number(row.revision)) ? Number(row.revision) : 0,
    currentCategory,
    currentCategoryDbValue: row.category ?? null,
    currentTags,
    currentTagsDbValue: row.tags_json ?? null,
    matchStatus: match.matchStatus,
    sourceKind,
    sourceTextAvailable: Boolean(sourceText)
  };

  if (!sourceText) {
    return {
      ...base,
      proposedCategory: currentCategory,
      proposedTags: currentTags,
      confidence: 0,
      confidenceBand: "unresolved",
      reasons: ["no-source-evidence"],
      changed: false,
      eligibleForRepair: false,
      scoreSummary: []
    };
  }

  const classification = classifyFacebookContent(sourceText);
  const confidence = sourceKind === "facebook" ? classification.confidence : Math.min(classification.confidence, 0.72);
  const changed = currentCategory !== classification.category || !sameTags(row.tags_json, classification.tags);

  return {
    ...base,
    proposedCategory: classification.category,
    proposedTags: classification.tags,
    confidence,
    confidenceBand: confidence >= 0.9 ? "high" : confidence >= 0.75 ? "medium" : "low",
    reasons:
      sourceKind === "facebook" ? classification.reasons : ["d1-title-summary-fallback", ...classification.reasons],
    changed,
    eligibleForRepair: changed && sourceKind === "facebook",
    scoreSummary: classification.scores.map((item) => ({ category: item.category, score: item.score }))
  };
}

function incrementCounter(counter, key) {
  const normalized = key || "(ว่าง)";
  counter[normalized] = (counter[normalized] ?? 0) + 1;
}

function summarize(rows, rawExport) {
  const summary = {
    generatedAt: new Date().toISOString(),
    facebookExport: {
      since: rawExport?.since ?? "",
      until: rawExport?.until ?? "",
      totalPosts: Array.isArray(rawExport?.posts) ? rawExport.posts.length : 0,
      chunkErrors: Array.isArray(rawExport?.errors) ? rawExport.errors.length : 0,
      sourceFailures: Array.isArray(rawExport?.targetedRecovery?.failures)
        ? rawExport.targetedRecovery.failures.length
        : 0
    },
    totalFacebookImports: rows.length,
    matched: 0,
    unmatched: 0,
    sourceTextMissing: 0,
    d1Fallback: 0,
    unresolved: 0,
    changed: 0,
    unchanged: 0,
    lowConfidence: 0,
    currentCategories: {},
    proposedCategories: {},
    matchStatuses: {},
    sourceKinds: {}
  };

  for (const row of rows) {
    incrementCounter(summary.currentCategories, row.currentCategory);
    incrementCounter(summary.proposedCategories, row.proposedCategory);
    incrementCounter(summary.matchStatuses, row.matchStatus);
    incrementCounter(summary.sourceKinds, row.sourceKind);

    if (row.matchStatus === "unmatched") summary.unmatched += 1;
    else summary.matched += 1;
    if (!row.sourceTextAvailable) summary.sourceTextMissing += 1;
    if (row.sourceKind === "d1-fallback") summary.d1Fallback += 1;
    if (row.sourceKind === "none") summary.unresolved += 1;
    if (row.changed) summary.changed += 1;
    else summary.unchanged += 1;
    if (row.confidence > 0 && row.confidence < 0.75) summary.lowConfidence += 1;
  }

  return summary;
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function reportToCsv(rows) {
  const headers = [
    "id",
    "slug",
    "source_id",
    "publish_at",
    "title",
    "match_status",
    "source_kind",
    "current_category",
    "proposed_category",
    "current_tags",
    "proposed_tags",
    "confidence",
    "confidence_band",
    "changed",
    "eligible_for_repair",
    "reasons",
    "canonical_url"
  ];
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.slug,
        row.sourceId,
        row.publishAt,
        row.title,
        row.matchStatus,
        row.sourceKind,
        row.currentCategory,
        row.proposedCategory,
        row.currentTags,
        row.proposedTags,
        row.confidence.toFixed(2),
        row.confidenceBand,
        row.changed ? "yes" : "no",
        row.eligibleForRepair ? "yes" : "no",
        row.reasons,
        row.canonicalUrl
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return `${lines.join("\n")}\n`;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function createRepairStatement(row) {
  const proposedTagsJson = stableTagsJson(row.proposedTags);

  return `UPDATE contents
SET category = ${sqlLiteral(row.proposedCategory)},
    tags_json = ${sqlLiteral(proposedTagsJson)},
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    updated_by = ${sqlLiteral(REPAIR_ACTOR)},
    revision = COALESCE(revision, 0) + 1
WHERE id = ${sqlLiteral(row.id)}
  AND template = 'facebook-embed'
  AND (owner = 'facebook-import' OR created_by = 'facebook-import')
  AND COALESCE(revision, 0) = ${row.revision}
  AND category IS ${sqlLiteral(row.currentCategoryDbValue)}
  AND tags_json IS ${sqlLiteral(row.currentTagsDbValue)};`;
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function writeRepairArtifacts(outputDir, reportRows, batchSize) {
  const repairRows = reportRows.filter((row) => row.eligibleForRepair);
  const batches = chunk(repairRows, batchSize);
  const manifest = {
    generatedAt: new Date().toISOString(),
    actor: REPAIR_ACTOR,
    totalRepairRows: repairRows.length,
    batchSize,
    batches: []
  };
  const allSql = [];

  for (let index = 0; index < batches.length; index += 1) {
    const number = String(index + 1).padStart(3, "0");
    const fileName = `repair-part-${number}.sql`;
    const statements = batches[index].map(createRepairStatement);
    const content = `${statements.join("\n\n")}\n`;

    await writeFile(path.join(outputDir, fileName), content, "utf8");
    manifest.batches.push({ file: fileName, rows: batches[index].length });
    allSql.push(...statements);
  }

  await writeFile(path.join(outputDir, "repair.sql"), `${allSql.join("\n\n")}\n`, "utf8");
  await writeFile(path.join(outputDir, "repair-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export async function runAudit({ d1Path, facebookPath, outputDir, batchSize = DEFAULT_BATCH_SIZE }) {
  const [d1Payload, facebookExport] = await Promise.all([readJson(d1Path), readJson(facebookPath)]);
  const d1Rows = flattenWranglerRows(d1Payload).filter(isFacebookImportRow);
  const indexes = buildFacebookIndexes(facebookExport);
  const reportRows = d1Rows.map((row) => buildReportRow(row, indexes));
  const summary = summarize(reportRows, facebookExport);

  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(reportRows, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "report.csv"), reportToCsv(reportRows), "utf8");
  await writeFile(
    path.join(outputDir, "review-low-confidence.csv"),
    reportToCsv(reportRows.filter((row) => row.confidence > 0 && row.confidence < 0.75)),
    "utf8"
  );
  await writeFile(path.join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  const repairManifest = await writeRepairArtifacts(outputDir, reportRows, batchSize);

  console.log(JSON.stringify({ ...summary, repairBatches: repairManifest.batches.length }, null, 2));

  if (summary.totalFacebookImports === 0) {
    throw new Error("No Facebook-imported D1 rows were found in the input query result");
  }

  if (summary.unmatched > 0 || summary.d1Fallback > 0 || summary.unresolved > 0) {
    console.warn(
      `Audit completed with ${summary.unmatched} Graph-unmatched row(s), ${summary.d1Fallback} D1 fallback classification(s), and ${summary.unresolved} unresolved row(s).`
    );
  }

  return { reportRows, summary, repairManifest };
}

export async function runVerification({ d1Path, reportPath, outputDir }) {
  const [d1Payload, reportRows] = await Promise.all([readJson(d1Path), readJson(reportPath)]);
  const currentById = new Map(flattenWranglerRows(d1Payload).map((row) => [String(row.id ?? ""), row]));
  const expected = reportRows.filter((row) => row?.eligibleForRepair);
  const mismatches = [];

  for (const row of expected) {
    const current = currentById.get(row.id);

    if (!current) {
      mismatches.push({ id: row.id, reason: "missing-after-apply" });
      continue;
    }

    const categoryMatches = String(current.category ?? "") === row.proposedCategory;
    const tagsMatch = sameTags(current.tags_json, row.proposedTags);

    if (!categoryMatches || !tagsMatch) {
      mismatches.push({
        id: row.id,
        reason: "metadata-mismatch",
        expectedCategory: row.proposedCategory,
        actualCategory: String(current.category ?? ""),
        expectedTags: row.proposedTags,
        actualTags: parseTagsJson(current.tags_json)
      });
    }
  }

  const result = {
    generatedAt: new Date().toISOString(),
    expectedRepairs: expected.length,
    verified: expected.length - mismatches.length,
    mismatches
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "verification.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));

  if (mismatches.length > 0) {
    throw new Error(`Verification failed for ${mismatches.length} Facebook metadata repair row(s)`);
  }

  return result;
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const d1Path = requireText(args["d1-json"], "--d1-json");
  const outputDir = args["output-dir"] ?? DEFAULT_OUTPUT_DIR;

  if (args["verify-report"]) {
    await runVerification({
      d1Path,
      reportPath: requireText(args["verify-report"], "--verify-report"),
      outputDir
    });
    return;
  }

  await runAudit({
    d1Path,
    facebookPath: requireText(args["facebook-json"], "--facebook-json"),
    outputDir,
    batchSize: positiveInteger(args["batch-size"], DEFAULT_BATCH_SIZE, "--batch-size")
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
