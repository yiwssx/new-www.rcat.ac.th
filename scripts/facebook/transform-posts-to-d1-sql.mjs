import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { classifyFacebookContent } from "./facebook-content-classifier.mjs";

const FALLBACK_TITLE = "ข่าวประชาสัมพันธ์จากวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด";
const FALLBACK_SUMMARY = "ข่าวประชาสัมพันธ์จากวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด เผยแพร่จากเพจ Facebook อย่างเป็นทางการ";
const DEFAULT_STATUS = "published";
const DEFAULT_CREATED_BY = "facebook-import";
const DEFAULT_OWNER = "facebook-import";
const DEFAULT_BATCH_SIZE = 100;
const SUMMARY_MAX_LENGTH = 210;
const SQL_COMPAT_COMMENT =
  "-- D1 remote execute compatibility: explicit SQL transaction control statements are intentionally omitted; one INSERT per post avoids SQLITE_TOOBIG on D1 remote import.";

const CONTENT_COLUMNS = [
  "id",
  "slug",
  "type",
  "status",
  "title",
  "summary",
  "body_snapshot",
  "category",
  "tags_json",
  "seo_title",
  "seo_description",
  "canonical_url",
  "featured",
  "reading_minutes",
  "template",
  "body_doc_id",
  "body_doc_url",
  "featured_media_id",
  "media_ids_json",
  "view_count",
  "last_viewed_at",
  "updated_at",
  "publish_at",
  "owner",
  "created_at",
  "deleted_at",
  "created_by",
  "updated_by",
  "revision"
];

function parseCliArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      throw new Error(`Unknown positional argument: ${arg}`);
    }

    const key = arg.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required`);
  }

  return value.trim();
}

function assertStatus(value) {
  if (value !== "published" && value !== "draft") {
    throw new Error("--status must be published or draft");
  }
}

function normalizePositiveInteger(value, defaultValue, label) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
}

function normalizeGeneratedAt(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.trim() !== "") {
    const timestamp = Date.parse(value);

    if (Number.isFinite(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }

  return new Date().toISOString();
}

function normalizeFacebookTimestamp(value, fallback) {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function sanitizePostId(value) {
  const sanitized = String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  if (!sanitized) {
    throw new Error("Facebook post id is required");
  }

  return sanitized;
}

function stripBase64Data(value) {
  return value.replace(/data:[^\s,;]+(?:;[^\s,;]+)*;base64,[A-Za-z0-9+/=_-]+/giu, "[base64 data removed]");
}

function getPostText(post) {
  const text =
    typeof post.message === "string" && post.message.trim() !== ""
      ? post.message
      : typeof post.story === "string"
        ? post.story
        : "";

  return stripBase64Data(text);
}

function stripUrls(value) {
  return value.replace(/https?:\/\/\S+|www\.\S+/giu, " ");
}

function stripHashtags(value) {
  return value.replace(/#[^\s#]+/gu, " ");
}

function stripDecorativeEmoji(value) {
  return value.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ");
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function meaningfulCharacterCount(value) {
  return Array.from(value.matchAll(/[\p{L}\p{N}]/gu)).length;
}

function isUrlOnly(value) {
  return /^(?:https?:\/\/\S+|www\.\S+)$/iu.test(value.trim());
}

function cleanTextForTitle(value) {
  return normalizeWhitespace(stripDecorativeEmoji(stripHashtags(stripUrls(value))));
}

function limitText(value, maxLength) {
  const characters = Array.from(value);

  if (characters.length <= maxLength) {
    return value;
  }

  const clipped = characters.slice(0, maxLength).join("");
  const lastSpace = clipped.lastIndexOf(" ");
  const safeClip = lastSpace >= Math.floor(maxLength * 0.65) ? clipped.slice(0, lastSpace) : clipped;

  return `${safeClip.replace(/[,\s.]+$/u, "")}...`;
}

function createTitle(postText) {
  const line = postText
    .split(/\r?\n/u)
    .map((entry) => cleanTextForTitle(entry))
    .find((entry) => entry && !isUrlOnly(entry) && meaningfulCharacterCount(entry) >= 8);

  if (!line) {
    return FALLBACK_TITLE;
  }

  return limitText(line, 110) || FALLBACK_TITLE;
}

function createSummaryInfo(postText) {
  const cleaned = normalizeWhitespace(stripHashtags(stripUrls(postText)));

  if (meaningfulCharacterCount(cleaned) < 20) {
    return { summary: FALLBACK_SUMMARY, truncated: false };
  }

  const truncated = Array.from(cleaned).length > SUMMARY_MAX_LENGTH;

  return { summary: limitText(cleaned, SUMMARY_MAX_LENGTH), truncated };
}

function createSummary(postText) {
  return createSummaryInfo(postText).summary;
}

function classifyCategory(postText) {
  return classifyFacebookContent(postText).category;
}

function createBodySnapshot(sourceUrl) {
  return `โพสต์นี้แสดงจาก Facebook ต้นฉบับ\n\nที่มา: ${sourceUrl}`;
}

function hasPostPermalink(post) {
  return typeof post?.permalink_url === "string" && post.permalink_url.trim() !== "";
}

function warningForPost(post) {
  const warnings = [];
  const postText = getPostText(post);
  const sourceUrlMissing = !hasPostPermalink(post);

  if (postText.trim() === "") {
    warnings.push("missing_message");
  }

  if (sourceUrlMissing) {
    warnings.push("missing_permalink", "skipped_missing_permalink");
  }

  if (createTitle(postText) === FALLBACK_TITLE) {
    warnings.push("fallback_title");
  }

  if (createSummaryInfo(postText).truncated) {
    warnings.push("summary_truncated");
  }

  return warnings.join("|");
}

export function transformFacebookPostToContentRow(post, options = {}) {
  const generatedAt = normalizeGeneratedAt(options.generatedAt);
  const status = options.status ?? DEFAULT_STATUS;
  const createdBy = options.createdBy ?? DEFAULT_CREATED_BY;
  const owner = options.owner ?? DEFAULT_OWNER;

  assertStatus(status);

  const sourceId = requireString(post?.id, "Facebook post id");
  const sanitizedPostId = sanitizePostId(sourceId);
  const postText = getPostText(post);
  const sourceUrl = requireString(post?.permalink_url, "Facebook permalink_url");
  const publishAt = normalizeFacebookTimestamp(post.created_time, generatedAt);
  const title = createTitle(postText);
  const summary = createSummary(postText);
  const bodySnapshot = createBodySnapshot(sourceUrl);
  const classification = classifyFacebookContent(postText);
  const category = classification.category;

  return {
    id: `facebook-post-${sanitizedPostId}`,
    slug: `facebook-${sanitizedPostId}`,
    type: "news",
    status,
    title,
    summary,
    body_snapshot: bodySnapshot,
    category,
    tags_json: JSON.stringify(classification.tags),
    seo_title: title,
    seo_description: summary,
    canonical_url: sourceUrl,
    featured: 0,
    reading_minutes: 1,
    template: "facebook-embed",
    body_doc_id: "",
    body_doc_url: "",
    featured_media_id: "",
    media_ids_json: "[]",
    view_count: 0,
    last_viewed_at: "",
    updated_at: generatedAt,
    publish_at: publishAt,
    owner,
    created_at: publishAt,
    deleted_at: "",
    created_by: createdBy,
    updated_by: createdBy,
    revision: 1
  };
}

export function transformFacebookPostsToContentRows(rawExport, options = {}) {
  if (!rawExport || !Array.isArray(rawExport.posts)) {
    throw new Error("Input JSON must contain a posts array");
  }

  const generatedAt = normalizeGeneratedAt(options.generatedAt ?? rawExport.generatedAt);

  return rawExport.posts
    .filter((post) => hasPostPermalink(post))
    .map((post) =>
      transformFacebookPostToContentRow(post, {
        ...options,
        generatedAt,
        pageId: options.pageId ?? rawExport.pageId
      })
    );
}

function toSqlLiteral(value) {
  if (value === null) {
    return "NULL";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Cannot serialize non-finite number to SQL");
    }

    return String(value);
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

function createSqlCommentValue(value) {
  return String(value ?? "")
    .replace(/\r?\n/gu, " ")
    .trim();
}

function createSqlHeader(rawExport, rows, generatedAt, options = {}) {
  const sourcePageId = createSqlCommentValue(rawExport.pageId ?? options.pageId ?? "");
  const since = createSqlCommentValue(rawExport.since ?? "");
  const until = createSqlCommentValue(rawExport.until ?? "");
  const header = [
    SQL_COMPAT_COMMENT,
    `-- source page id: ${sourcePageId}`,
    `-- date range: ${since} to ${until}`,
    `-- generated at: ${generatedAt}`,
    `-- total rows: ${rows.length}`
  ];

  if (options.batchIndex !== undefined && options.batchTotal !== undefined) {
    header.push(`-- batch: ${options.batchIndex} of ${options.batchTotal}`, `-- batch rows: ${rows.length}`);
  }

  header.push("");

  return header;
}

function createInsertStatement(row) {
  return `INSERT OR IGNORE INTO contents (${CONTENT_COLUMNS.join(", ")}) VALUES (${CONTENT_COLUMNS.map((column) => toSqlLiteral(row[column])).join(", ")});`;
}

function createFacebookPostsSqlFromRows(rawExport, rows, generatedAt, options = {}) {
  const header = createSqlHeader(rawExport, rows, generatedAt, options);
  const statements = [];

  rows.forEach((row) => {
    statements.push(createInsertStatement(row));
  });

  statements.push("");

  return [...header, ...statements].join("\n");
}

export function createFacebookPostsSql(rawExport, options = {}) {
  const generatedAt = normalizeGeneratedAt(options.generatedAt ?? rawExport?.generatedAt);
  const rows = transformFacebookPostsToContentRows(rawExport, { ...options, generatedAt });

  return createFacebookPostsSqlFromRows(rawExport, rows, generatedAt, options);
}

function partOutputPath(outputPath, index) {
  const parsed = path.parse(outputPath);
  const partNumber = String(index + 1).padStart(3, "0");

  return path.join(parsed.dir, `${parsed.name}.part-${partNumber}.sql`);
}

function manifestOutputPath(outputPath) {
  const parsed = path.parse(outputPath);

  return path.join(parsed.dir, `${parsed.name}.manifest.json`);
}

function toManifestPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function chunkRows(rows, batchSize) {
  const chunks = [];

  for (let index = 0; index < rows.length; index += batchSize) {
    chunks.push(rows.slice(index, index + batchSize));
  }

  return chunks;
}

export function createFacebookPostsSqlArtifacts(rawExport, options = {}) {
  const outputPath = requireString(options.outputPath, "outputPath");
  const inputPath = options.inputPath ?? "";
  const generatedAt = normalizeGeneratedAt(options.generatedAt ?? rawExport?.generatedAt);
  const batchSize = normalizePositiveInteger(options.batchSize, DEFAULT_BATCH_SIZE, "batchSize");
  const rows = transformFacebookPostsToContentRows(rawExport, { ...options, generatedAt });
  const rowBatches = chunkRows(rows, batchSize);
  const files = rowBatches.map((batchRows, index) => {
    const filePath = partOutputPath(outputPath, index);

    return {
      path: filePath,
      rows: batchRows.length,
      sql: createFacebookPostsSqlFromRows(rawExport, batchRows, generatedAt, {
        ...options,
        batchIndex: index + 1,
        batchTotal: rowBatches.length
      })
    };
  });

  return {
    sql: createFacebookPostsSqlFromRows(rawExport, rows, generatedAt, options),
    rows,
    files,
    manifestPath: manifestOutputPath(outputPath),
    manifest: {
      generatedAt,
      input: toManifestPath(inputPath),
      totalRows: rows.length,
      batchSize,
      files: files.map((file) => ({
        path: toManifestPath(file.path),
        rows: file.rows
      }))
    }
  };
}

function csvValue(value) {
  const text = String(value ?? "");

  if (/[",\r\n]/u.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function createFacebookImportReportCsv(rawExport, rows, options = {}) {
  const resolvedRows = rows ?? transformFacebookPostsToContentRows(rawExport, options);
  const rowBySourceId = new Map(resolvedRows.map((row) => [row.id.replace(/^facebook-post-/u, ""), row]));
  const lines = [
    "source_id,publish_at,title,category,status,slug,source_url,template,has_message,has_permalink,warning"
  ];

  rawExport.posts.forEach((post) => {
    const sanitizedPostId = sanitizePostId(post.id);
    const row = rowBySourceId.get(sanitizedPostId);
    const postText = getPostText(post);
    const postHasPermalink = hasPostPermalink(post);

    lines.push(
      [
        post.id,
        row?.publish_at ?? normalizeFacebookTimestamp(post.created_time, ""),
        row?.title ?? createTitle(postText),
        row?.category ?? classifyCategory(postText),
        row?.status ?? options.status ?? DEFAULT_STATUS,
        row?.slug ?? `facebook-${sanitizedPostId}`,
        row?.canonical_url ?? post.permalink_url ?? "",
        row?.template ?? "facebook-embed",
        postText.trim() ? "yes" : "no",
        postHasPermalink ? "yes" : "no",
        warningForPost(post)
      ]
        .map(csvValue)
        .join(",")
    );
  });

  return `${lines.join("\n")}\n`;
}

async function readJson(inputPath) {
  return JSON.parse(await readFile(inputPath, "utf8"));
}

async function writeTextFile(outputPath, content) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, "utf8");
}

function defaultReportPath(outputPath) {
  const parsed = path.parse(outputPath);

  return path.join(parsed.dir, `${parsed.name}.report.csv`);
}

async function runCli() {
  const args = parseCliArgs(process.argv.slice(2));
  const inputPath = requireString(args.input, "--input");
  const outputPath = requireString(args.output, "--output");
  const status = args.status ?? DEFAULT_STATUS;
  const createdBy = args["created-by"] ?? DEFAULT_CREATED_BY;
  const owner = args.owner ?? DEFAULT_OWNER;
  const reportOutputPath = args["report-output"] ?? defaultReportPath(outputPath);
  const batchSize = normalizePositiveInteger(args["batch-size"], DEFAULT_BATCH_SIZE, "--batch-size");

  assertStatus(status);

  const rawExport = await readJson(inputPath);
  const generatedAt = new Date().toISOString();
  const artifacts = createFacebookPostsSqlArtifacts(rawExport, {
    batchSize,
    createdBy,
    generatedAt,
    inputPath,
    owner,
    outputPath,
    status
  });

  await writeTextFile(outputPath, artifacts.sql);
  await Promise.all(artifacts.files.map((file) => writeTextFile(file.path, file.sql)));
  await writeTextFile(artifacts.manifestPath, `${JSON.stringify(artifacts.manifest, null, 2)}\n`);
  await writeTextFile(reportOutputPath, createFacebookImportReportCsv(rawExport, artifacts.rows, { status }));

  console.log(`Generated ${artifacts.rows.length} SQL row(s): ${outputPath}`);
  console.log(`Generated ${artifacts.files.length} SQL batch file(s): ${artifacts.manifestPath}`);
  console.log(`Generated import report: ${reportOutputPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
